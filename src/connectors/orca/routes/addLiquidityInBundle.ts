import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import {
  PDAUtil, PositionBundleUtil, IGNORE_CACHE,
  increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil, PriceMath
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage, TransactionBuilder } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';
import BN from 'bn.js';

class AddLiquidityInBundleController extends OrcaController {
  async addLiquidityInBundle(
    positionBundleAddress: string,
    quoteTokenAmounts: number[],
    slippagePct?: number
  ): Promise<{ signature: string; liquiditiesBefore: string[]; liquiditiesAfter: string[] }> {
    await this.loadOrca();

    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    console.log("position bundle address:", position_bundle_pubkey.toBase58());

    // Get PositionBundle account
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey, IGNORE_CACHE);

    // Get the bundle indexes in use in PositionBundle
    const occupied_bundle_indexes = PositionBundleUtil.getOccupiedBundleIndexes(position_bundle);
    console.log("occupied bundle indexes:", occupied_bundle_indexes.slice(0, Math.max(quoteTokenAmounts.length, 10)));

    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    const liquiditiesBefore: string[] = [];
    const positions: any[] = [];

    for (let i = 0; i < quoteTokenAmounts.length; i++) {
      const bundled_position_pda = PDAUtil.getBundledPosition(this.ctx.program.programId, position_bundle.positionBundleMint, occupied_bundle_indexes[i]);
      console.log(`bundled position ${i} pubkey:`, bundled_position_pda.publicKey.toBase58());

      const position = await this.client.getPosition(bundled_position_pda.publicKey);
      const whirlpool = await this.client.getPool(position.getData().whirlpool);

      const token_a = whirlpool.getTokenAInfo();
      const token_b = whirlpool.getTokenBInfo();

      const quote_token_amount = DecimalUtil.toBN(new Decimal(quoteTokenAmounts[i].toString()), token_b.decimals);

      const whirlpool_data = whirlpool.getData();

      const actualPrice = PriceMath.sqrtPriceX64ToPrice(
        whirlpool_data.sqrtPrice,
        token_a.decimals,
        token_b.decimals
      );

      const lowerPrice = PriceMath.tickIndexToPrice(position.getData().tickLowerIndex, token_a.decimals, token_b.decimals);
      const upperPrice = PriceMath.tickIndexToPrice(position.getData().tickUpperIndex, token_a.decimals, token_b.decimals);

      console.log(`Position ${i} - Actual Pool Price:`, actualPrice.toString());
      console.log(`Position ${i} - Lower Price:`, lowerPrice.toString());
      console.log(`Position ${i} - Upper Price:`, upperPrice.toString());

      let quoteTokenQuote, baseTokenQuote;

      if (actualPrice.gte(upperPrice)) {
        // Price is higher than position upper price, use entire amount as quote token
        quoteTokenQuote = await this.fetchQuote(whirlpool_data, position, token_b, quote_token_amount, slippage, token_a, token_b);
        console.log("quoteTokenQuote", quoteTokenQuote);
      } else if (actualPrice.lte(lowerPrice)) {
        // Price is lower than position lower price, convert entire amount to base token
        const base_token_amount = DecimalUtil.toBN(
          new Decimal(quoteTokenAmounts[i].toString()).div(actualPrice),
          token_a.decimals
        );
        baseTokenQuote = await this.fetchQuote(whirlpool_data, position, token_a, base_token_amount, slippage, token_a, token_b);
      } else {
        // Price is between position upper and lower price
        const priceRange = upperPrice.sub(lowerPrice);
        const quoteTokenPortion = upperPrice.sub(actualPrice).div(priceRange);
        const baseTokenPortion = new Decimal(1).sub(quoteTokenPortion);

        const quote_amount = DecimalUtil.toBN(
          new Decimal(quoteTokenAmounts[i].toString()).mul(quoteTokenPortion),
          token_b.decimals
        );
        const base_amount = DecimalUtil.toBN(
          new Decimal(quoteTokenAmounts[i].toString()).mul(baseTokenPortion).div(actualPrice),
          token_a.decimals
        );

        quoteTokenQuote = await this.fetchQuote(whirlpool_data, position, token_b, quote_amount, slippage, token_a, token_b);
        baseTokenQuote = await this.fetchQuote(whirlpool_data, position, token_a, base_amount, slippage, token_a, token_b);
      }

      // Output the estimation
      if (quoteTokenQuote) {
        console.log(`Position ${i} - Token B max input:`, DecimalUtil.fromBN(quoteTokenQuote.tokenMaxB, token_b.decimals).toFixed(token_b.decimals));
      }
      if (baseTokenQuote) {
        console.log(`Position ${i} - Token A max input:`, DecimalUtil.fromBN(baseTokenQuote.tokenMaxA, token_a.decimals).toFixed(token_a.decimals));
      }

      liquiditiesBefore.push(position.getData().liquidity.toString());
      console.log(`Position ${i} - liquidity(before):`, liquiditiesBefore[i]);

      let increase_liquidity_tx;

      if (actualPrice.gte(upperPrice)) {
        increase_liquidity_tx = await position.increaseLiquidity(quoteTokenQuote);
      } else if (actualPrice.lte(lowerPrice)) {
        increase_liquidity_tx = await position.increaseLiquidity(baseTokenQuote);
      } else {
        // Use only quoteTokenQuote when price is between upper and lower
        increase_liquidity_tx = await position.increaseLiquidity(quoteTokenQuote);
      }

      tx_builder.addInstruction(increase_liquidity_tx.compressIx(true));

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

  private async fetchQuote(
    whirlpool_data: any,
    position: any,
    inputToken: any,
    inputAmount: BN,
    slippage: Percentage,
    token_a: any,
    token_b: any
  ) {
    return increaseLiquidityQuoteByInputTokenWithParams({
      tokenMintA: token_a.mint,
      tokenMintB: token_b.mint,
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      inputTokenMint: inputToken.mint,
      inputTokenAmount: inputAmount,
      slippageTolerance: slippage,
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });
  }
}

export default function addLiquidityInBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new AddLiquidityInBundleController();

  fastify.post(`/${folderName}/add-liquidity-in-bundle`, {
    schema: {
      tags: [folderName],
      description: 'Add liquidity to multiple Orca positions in a bundle',
      body: Type.Object({
        positionBundleAddress: Type.String(),
        quoteTokenAmounts: Type.Array(Type.Number()),
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
      const { positionBundleAddress, quoteTokenAmounts, slippagePct } = request.body as {
        positionBundleAddress: string;
        quoteTokenAmounts: number[];
        slippagePct?: number;
      };
      fastify.log.info(`Adding liquidity to Orca position bundle: ${positionBundleAddress}`);
      const result = await controller.addLiquidityInBundle(
        positionBundleAddress,
        quoteTokenAmounts,
        slippagePct
      );
      return result;
    }
  });
}