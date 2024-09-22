import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil, PriceMath } from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';
import BN from 'bn.js';

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

    const whirlpool_data = whirlpool.getData();

    const actualPrice = PriceMath.sqrtPriceX64ToPrice(
      whirlpool_data.sqrtPrice,
      token_a.decimals,
      token_b.decimals
    );

    const lowerPrice = PriceMath.tickIndexToPrice(position.getData().tickLowerIndex, token_a.decimals, token_b.decimals);
    const upperPrice = PriceMath.tickIndexToPrice(position.getData().tickUpperIndex, token_a.decimals, token_b.decimals);

    console.log('Actual Pool Price:', actualPrice.toString());
    console.log('Position Lower Price:', lowerPrice.toString());
    console.log('Position Upper Price:', upperPrice.toString());

    let quoteTokenQuote, baseTokenQuote;

    if (actualPrice.gte(upperPrice)) {
      // Price is higher than position upper price, use entire amount as quote token
      quoteTokenQuote = await this.fetchQuote(whirlpool_data, position, token_b, quote_token_amount, slippage, token_a, token_b);
    } else if (actualPrice.lte(lowerPrice)) {
      // Price is lower than position lower price, convert entire amount to base token
      const base_token_amount = DecimalUtil.toBN(
        new Decimal(quoteTokenAmount.toString()).div(actualPrice),
        token_a.decimals
      );
      baseTokenQuote = await this.fetchQuote(whirlpool_data, position, token_a, base_token_amount, slippage, token_a, token_b);
    } else {
      // Price is between position upper and lower price
      const priceRange = upperPrice.sub(lowerPrice);
      const quoteTokenPortion = upperPrice.sub(actualPrice).div(priceRange);
      const baseTokenPortion = new Decimal(1).sub(quoteTokenPortion);

      const quote_amount = DecimalUtil.toBN(
        new Decimal(quoteTokenAmount.toString()).mul(quoteTokenPortion),
        token_b.decimals
      );
      const base_amount = DecimalUtil.toBN(
        new Decimal(quoteTokenAmount.toString()).mul(baseTokenPortion).div(actualPrice),
        token_a.decimals
      );

      quoteTokenQuote = await this.fetchQuote(whirlpool_data, position, token_b, quote_amount, slippage, token_a, token_b);
      baseTokenQuote = await this.fetchQuote(whirlpool_data, position, token_a, base_amount, slippage, token_a, token_b);
    }

    // Output the estimation
    if (quoteTokenQuote) {
      console.log("Token B max input:", DecimalUtil.fromBN(quoteTokenQuote.tokenMaxB, token_b.decimals).toFixed(token_b.decimals));
    }
    if (baseTokenQuote) {
      console.log("Token A max input:", DecimalUtil.fromBN(baseTokenQuote.tokenMaxA, token_a.decimals).toFixed(token_a.decimals));
    }

    // Get liquidity before transaction
    const liquidityBefore = position.getData().liquidity.toString();
    console.log("liquidity(before):", liquidityBefore);

    // Remove transaction builder
    let increase_liquidity_tx;

    if (actualPrice.gte(upperPrice)) {
      increase_liquidity_tx = await position.increaseLiquidity(quoteTokenQuote);
    } else if (actualPrice.lte(lowerPrice)) {
      increase_liquidity_tx = await position.increaseLiquidity(baseTokenQuote);
    } else {
      // Use only quoteTokenQuote when price is between upper and lower
      increase_liquidity_tx = await position.increaseLiquidity(quoteTokenQuote);
    }

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