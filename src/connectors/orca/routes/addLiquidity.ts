import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil } from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';

class AddLiquidityController extends OrcaController {
  async addLiquidity(
    positionAddress: string,
    quoteTokenAmount: number,
    slippagePct?: number
  ): Promise<{ signature: string; liquidityBefore: string; liquidityAfter: string }> {
    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    console.log("position address:", position_pubkey.toBase58());

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const whirlpool = await this.client.getPool(position.getData().whirlpool);

    // Get token info
    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();

    // Convert quoteTokenAmount to Decimal
    const quote_token_amount = DecimalUtil.toBN(new Decimal(quoteTokenAmount.toString()), token_b.decimals);
    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    // Obtain deposit estimation
    const whirlpool_data = whirlpool.getData();
    const quote = increaseLiquidityQuoteByInputTokenWithParams({
      // Pass the pool definition and state
      tokenMintA: token_a.mint,
      tokenMintB: token_b.mint,
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      // Pass the price range of the position as is
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      // Input token and amount
      inputTokenMint: token_b.mint,
      inputTokenAmount: quote_token_amount,
      // Acceptable slippage
      slippageTolerance: slippage,
      // Get token info for TokenExtensions
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });

    // Output the estimation
    console.log("Token A max input:", DecimalUtil.fromBN(quote.tokenMaxA, token_a.decimals).toFixed(token_a.decimals));
    console.log("Token B max input:", DecimalUtil.fromBN(quote.tokenMaxB, token_b.decimals).toFixed(token_b.decimals));

    // Get liquidity before transaction
    const liquidityBefore = position.getData().liquidity.toString();
    console.log("liquidity(before):", liquidityBefore);

    // Create a transaction
    const increase_liquidity_tx = await position.increaseLiquidity(quote);

    // Send the transaction
    const signature = await increase_liquidity_tx.buildAndExecute();
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

export default function addLiquidityRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new AddLiquidityController();

  fastify.post(`/${folderName}/add-liquidity`, {
    schema: {
      tags: [folderName],
      description: 'Add liquidity to an Orca position',
      body: Type.Object({
        positionAddress: Type.String({ default: 'FCDbmwuE3WSuZh5kM2tkTiojgoVYeis1yJs6Ewe6KETi' }),
        quoteTokenAmount: Type.Number({ default: 1 }),
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
      const { positionAddress, quoteTokenAmount, slippagePct } = request.body as {
        positionAddress: string;
        quoteTokenAmount: number;
        slippagePct?: number;
      };
      fastify.log.info(`Adding liquidity to Orca position: ${positionAddress}`);
      const result = await controller.addLiquidity(
        positionAddress,
        quoteTokenAmount,
        slippagePct
      );
      return result;
    }
  });
}