import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import {
  PDAUtil, PositionBundleUtil, IGNORE_CACHE,
  decreaseLiquidityQuoteByLiquidityWithParams, TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage, TransactionBuilder } from "@orca-so/common-sdk";
import { BN } from "bn.js";
import { OrcaController } from '../orca.controller';

class RemoveLiquidityInBundleController extends OrcaController {
  async removeLiquidityInBundle(
    positionBundleAddress: string,
    percentages: number[],
    slippagePct?: number
  ): Promise<{ signature: string; liquiditiesBefore: string[]; liquiditiesAfter: string[] }> {
    await this.loadOrca();

    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    console.log("position bundle address:", position_bundle_pubkey.toBase58());

    // Get PositionBundle account
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey, IGNORE_CACHE);

    // Get the bundle indexes in use in PositionBundle
    const occupied_bundle_indexes = PositionBundleUtil.getOccupiedBundleIndexes(position_bundle);
    console.log("occupied bundle indexes:", occupied_bundle_indexes.slice(0, Math.max(percentages.length, 10)));

    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    const liquiditiesBefore: string[] = [];
    const positions: any[] = [];

    for (let i = 0; i < percentages.length; i++) {
      const bundled_position_pda = PDAUtil.getBundledPosition(this.ctx.program.programId, position_bundle.positionBundleMint, occupied_bundle_indexes[i]);
      console.log(`bundled position ${i} pubkey:`, bundled_position_pda.publicKey.toBase58());

      const position = await this.client.getPosition(bundled_position_pda.publicKey);
      const whirlpool = await this.client.getPool(position.getData().whirlpool);

      const liquidity = position.getData().liquidity;
      const delta_liquidity = liquidity.mul(new BN(percentages[i])).div(new BN(100));

    //   console.log(`Position ${i} - liquidity:`, liquidity.toString());
    //   console.log(`Position ${i} - delta_liquidity:`, delta_liquidity.toString());
    
      const whirlpool_data = whirlpool.getData();
      const token_a = whirlpool.getTokenAInfo();
      const token_b = whirlpool.getTokenBInfo();
      const quote = decreaseLiquidityQuoteByLiquidityWithParams({
        sqrtPrice: whirlpool_data.sqrtPrice,
        tickCurrentIndex: whirlpool_data.tickCurrentIndex,
        tickLowerIndex: position.getData().tickLowerIndex,
        tickUpperIndex: position.getData().tickUpperIndex,
        liquidity: delta_liquidity,
        slippageTolerance: slippage,
        tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
      });

      console.log(`Position ${i} - Token A min output:`, DecimalUtil.fromBN(quote.tokenMinA, token_a.decimals).toFixed(token_a.decimals));
      console.log(`Position ${i} - Token B min output:`, DecimalUtil.fromBN(quote.tokenMinB, token_b.decimals).toFixed(token_b.decimals));

      liquiditiesBefore.push(liquidity.toString());
      console.log(`Position ${i} - liquidity(before):`, liquiditiesBefore[i]);

      const decrease_liquidity_tx = await position.decreaseLiquidity(quote);
      tx_builder.addInstruction(decrease_liquidity_tx.compressIx(true));

      positions.push(position);
    }

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    // Get liquidities after transaction
    const liquiditiesAfter = await Promise.all(positions.map(async (position) => {
      return (await position.refreshData()).liquidity.toString();
    }));

    liquiditiesAfter.forEach((liquidity, i) => {
      console.log(`Position ${i} - liquidity(after):`, liquidity);
    });

    return {
      signature,
      liquiditiesBefore,
      liquiditiesAfter,
    };
  }
}

export default function removeLiquidityInBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new RemoveLiquidityInBundleController();

  fastify.post(`/${folderName}/remove-liquidity-in-bundle`, {
    schema: {
      tags: [folderName],
      description: 'Remove liquidity from multiple Orca positions in a bundle',
      body: Type.Object({
        positionBundleAddress: Type.String(),
        percentages: Type.Array(Type.Number()),
        slippagePct: Type.Optional(Type.Number({ default: 1 })),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
          liquiditiesBefore: Type.Array(Type.String()),
          liquiditiesAfter: Type.Array(Type.String()),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionBundleAddress, percentages, slippagePct } = request.body as {
        positionBundleAddress: string;
        percentages: number[];
        slippagePct?: number;
      };
      fastify.log.info(`Removing liquidity from Orca position bundle: ${positionBundleAddress}`);
      const result = await controller.removeLiquidityInBundle(
        positionBundleAddress,
        percentages,
        slippagePct
      );
      return result;
    }
  });
}
