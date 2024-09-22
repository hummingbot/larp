import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil, PriceMath } from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';
import { SolanaController } from '../../solana/solana.controller';
import { Token } from '@solflare-wallet/utl-sdk';
import BN from 'bn.js';

class AddLiquidityQuoteController extends OrcaController {
  async quote(
    positionAddress: string,
    quoteTokenAmount: number,
    slippagePct?: number,
  ): Promise<{
    baseToken: { address: string; chainId?: number; name: string; symbol: string; decimals: number; maximum: number; estimated: number };
    quoteToken: { address: string; chainId?: number; name: string; symbol: string; decimals: number; maximum: number; estimated: number };
  }> {
    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    const position = await this.client.getPosition(position_pubkey);
    const whirlpool = await this.client.getPool(position.getData().whirlpool);
    const whirlpool_base_token = whirlpool.getTokenAInfo();
    const whirlpool_quote_token = whirlpool.getTokenBInfo();

    const solanaController = new SolanaController();
    const baseToken = await solanaController.getTokenByAddress(whirlpool_base_token.mint.toBase58());
    const quoteToken = await solanaController.getTokenByAddress(whirlpool_quote_token.mint.toBase58());

    const actualPrice = PriceMath.sqrtPriceX64ToPrice(
      whirlpool.getData().sqrtPrice,
      whirlpool_base_token.decimals,
      whirlpool_quote_token.decimals
    );

    const lowerPrice = PriceMath.tickIndexToPrice(position.getData().tickLowerIndex, whirlpool_base_token.decimals, whirlpool_quote_token.decimals);
    const upperPrice = PriceMath.tickIndexToPrice(position.getData().tickUpperIndex, whirlpool_base_token.decimals, whirlpool_quote_token.decimals);

    console.log('Actual Pool Price:', actualPrice.toString());
    console.log('Position Lower Price:', lowerPrice.toString());
    console.log('Position Upper Price:', upperPrice.toString());

    const quote_token_amount = DecimalUtil.toBN(new Decimal(quoteTokenAmount.toString()), quoteToken.decimals);
    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100);

    const whirlpool_data = whirlpool.getData();
    let baseTokenQuote, quoteTokenQuote;

    if (actualPrice.gte(upperPrice)) {
      // Price is higher than position upper price, use entire amount as quote token
      quoteTokenQuote = await this.fetchQuote(whirlpool_data, position, quoteToken, quote_token_amount, slippage, whirlpool_base_token, whirlpool_quote_token);
      baseTokenQuote = quoteTokenQuote;
    } else if (actualPrice.lte(lowerPrice)) {
      // Price is lower than position lower price, convert entire amount to base token
      const base_token_amount = DecimalUtil.toBN(
        new Decimal(quoteTokenAmount.toString()).div(actualPrice),
        baseToken.decimals
      );
      baseTokenQuote = await this.fetchQuote(whirlpool_data, position, baseToken, base_token_amount, slippage, whirlpool_base_token, whirlpool_quote_token);
      quoteTokenQuote = baseTokenQuote;
    } else {
      // Price is between position upper and lower price
      const priceRange = upperPrice.sub(lowerPrice);
      const quoteTokenPortion = upperPrice.sub(actualPrice).div(priceRange);
      const baseTokenPortion = new Decimal(1).sub(quoteTokenPortion);

      const quote_amount = DecimalUtil.toBN(
        new Decimal(quoteTokenAmount.toString()).mul(quoteTokenPortion),
        quoteToken.decimals
      );
      const base_amount = DecimalUtil.toBN(
        new Decimal(quoteTokenAmount.toString()).mul(baseTokenPortion).div(actualPrice),
        baseToken.decimals
      );

      quoteTokenQuote = await this.fetchQuote(whirlpool_data, position, quoteToken, quote_amount, slippage, whirlpool_base_token, whirlpool_quote_token);
      baseTokenQuote = await this.fetchQuote(whirlpool_data, position, baseToken, base_amount, slippage, whirlpool_base_token, whirlpool_quote_token);
    }

    return {
      baseToken: {
        ...baseToken,
        maximum: DecimalUtil.fromBN(baseTokenQuote.tokenMaxA, baseToken.decimals).toNumber(),
        estimated: DecimalUtil.fromBN(baseTokenQuote.tokenEstA, baseToken.decimals).toNumber(),
      },
      quoteToken: {
        ...quoteToken,
        maximum: DecimalUtil.fromBN(quoteTokenQuote.tokenMaxB, quoteToken.decimals).toNumber(),
        estimated: DecimalUtil.fromBN(quoteTokenQuote.tokenEstB, quoteToken.decimals).toNumber(),
      },
    };
  }

  private async fetchQuote(
    whirlpool_data: any,
    position: any,
    inputToken: Token,
    inputAmount: BN,
    slippage: Percentage,
    whirlpool_base_token: any,
    whirlpool_quote_token: any
  ) {
    return increaseLiquidityQuoteByInputTokenWithParams({
      tokenMintA: whirlpool_base_token.mint,
      tokenMintB: whirlpool_quote_token.mint,
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      inputTokenMint: new PublicKey(inputToken.address),
      inputTokenAmount: inputAmount,
      slippageTolerance: slippage,
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });
  }
}

export default function addLiquidityQuoteRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new AddLiquidityQuoteController();

  fastify.post(`/${folderName}/add-liquidity-quote`, {
    schema: {
      tags: [folderName],
      description: 'Get quote for adding liquidity to an Orca position',
      body: Type.Object({
        positionAddress: Type.String(),
        quoteTokenAmount: Type.Number(),
        slippagePct: Type.Optional(Type.Number()),
      }),
      response: {
        200: Type.Object({
          baseToken: Type.Object({
            address: Type.String(),
            chainId: Type.Optional(Type.Number()),
            name: Type.String(),
            symbol: Type.String(),
            decimals: Type.Number(),
            maximum: Type.Number(),
            estimated: Type.Number(),
          }),
          quoteToken: Type.Object({
            address: Type.String(),
            chainId: Type.Optional(Type.Number()),
            name: Type.String(),
            symbol: Type.String(),
            decimals: Type.Number(),
            maximum: Type.Number(),
            estimated: Type.Number(),
          }),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionAddress, quoteTokenAmount, slippagePct } = request.body as {
        positionAddress: string;
        quoteTokenAmount: number;
        slippagePct?: number;
      };
      const result = await controller.quote(positionAddress, quoteTokenAmount, slippagePct);
      return result;
    }
  });
}
