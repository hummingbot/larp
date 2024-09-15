import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { increaseLiquidityQuoteByInputTokenWithParams, TokenExtensionUtil } from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';
import { SolanaController } from '../../solana/solana.controller'; // Ensure the path is correct
import { TokenInfoResponse } from '../../solana/routes/listTokens'; // Import TokenInfoResponse

class AddLiquidityQuoteController extends OrcaController {
  async quote(
    positionAddress: string,
    quoteTokenAmount: number,
    slippagePct?: number,
  ): Promise<{
    baseToken: { address: string; chainId?: number; name: string; symbol: string; decimals: number; maximum: number };
    quoteToken: { address: string; chainId?: number; name: string; symbol: string; decimals: number; maximum: number };
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

    const quote_token_amount = DecimalUtil.toBN(new Decimal(quoteTokenAmount.toString()), quoteToken.decimals);
    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100);

    const whirlpool_data = whirlpool.getData();
    const quote = increaseLiquidityQuoteByInputTokenWithParams({
      tokenMintA: whirlpool_base_token.mint,
      tokenMintB: whirlpool_quote_token.mint,
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      inputTokenMint: new PublicKey(quoteToken.address),
      inputTokenAmount: quote_token_amount,
      slippageTolerance: slippage,
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });

    return {
      baseToken: { ...baseToken, maximum: DecimalUtil.fromBN(quote.tokenMaxA, baseToken.decimals).toNumber()},
      quoteToken: { ...quoteToken, maximum: DecimalUtil.fromBN(quote.tokenMaxB, quoteToken.decimals).toNumber()},
    };
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
          }),
          quoteToken: Type.Object({
            address: Type.String(),
            chainId: Type.Optional(Type.Number()),
            name: Type.String(),
            symbol: Type.String(),
            decimals: Type.Number(),
            maximum: Type.Number(),
          }),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionAddress, quoteTokenAmount, slippagePct } = request.body as {
        positionAddress: string;
        quoteTokenAmount: number;
        slippagePct?: number;
        inputToken: string;
        maximum: number;
      };
      const result = await controller.quote(positionAddress, quoteTokenAmount, slippagePct);
      return result;
    }
  });
}
