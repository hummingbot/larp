import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { BN } from "bn.js";
import {
  decreaseLiquidityQuoteByLiquidityWithParams,
  TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import { OrcaController } from '../orca.controller';

class RemoveLiquidityController extends OrcaController {
  async removeLiquidity(
    positionAddress: string,
    percentageToRemove: number,
    slippagePct?: number
  ): Promise<{ signature: string; liquidityBefore: string; liquidityAfter: string }> {
    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    console.log("position address:", position_pubkey.toBase58());

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const whirlpool = await this.client.getPool(position.getData().whirlpool);

    // Calculate the liquidity to be withdrawn
    const liquidity = position.getData().liquidity;
    const delta_liquidity = liquidity.mul(new BN(percentageToRemove)).div(new BN(100));

    console.log("liquidity:", liquidity.toString());
    console.log("delta_liquidity:", delta_liquidity.toString());

    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    // Obtain withdraw estimation
    const whirlpool_data = whirlpool.getData();
    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();
    const quote = decreaseLiquidityQuoteByLiquidityWithParams({
      // Pass the pool state as is
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      // Pass the price range of the position as is
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      // Liquidity to be withdrawn
      liquidity: delta_liquidity,
      // Acceptable slippage
      slippageTolerance: slippage,
      // Get token info for TokenExtensions
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });
    
    // Output the estimation
    console.log("Token A min output:", DecimalUtil.fromBN(quote.tokenMinA, token_a.decimals).toFixed(token_a.decimals));
    console.log("Token B min output:", DecimalUtil.fromBN(quote.tokenMinB, token_b.decimals).toFixed(token_b.decimals));

    // Get liquidity before transaction
    const liquidityBefore = position.getData().liquidity.toString();
    console.log("liquidity(before):", liquidityBefore);

    // Create a transaction
    const decrease_liquidity_tx = await position.decreaseLiquidity(quote);

    // Send the transaction
    const signature = await decrease_liquidity_tx.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    // Get liquidity after transaction
    const liquidityAfter = (await position.refreshData()).liquidity.toString();
    console.log("liquidity(after):", liquidityAfter);

    return {
      signature,
      liquidityBefore,
      liquidityAfter,
    };
  }
}

export default function removeLiquidityRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new RemoveLiquidityController();

  fastify.post(`/${folderName}/remove-liquidity`, {
    schema: {
      tags: [folderName],
      description: 'Remove liquidity from an Orca position',
      body: Type.Object({
        positionAddress: Type.String({ default: 'FCDbmwuE3WSuZh5kM2tkTiojgoVYeis1yJs6Ewe6KETi' }),
        percentageToRemove: Type.Number({ default: 30, minimum: 0, maximum: 100 }),
        slippagePct: Type.Optional(Type.Number({ default: 1 })),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
          liquidityBefore: Type.String(),
          liquidityAfter: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionAddress, percentageToRemove, slippagePct } = request.body as {
        positionAddress: string;
        percentageToRemove: number;
        slippagePct?: number;
      };
      fastify.log.info(`Removing liquidity from Orca position: ${positionAddress}`);
      const result = await controller.removeLiquidity(
        positionAddress,
        percentageToRemove,
        slippagePct
      );
      return result;
    }
  });
}
