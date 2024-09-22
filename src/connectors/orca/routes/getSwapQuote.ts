import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from "@solana/web3.js";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  PDAUtil, swapQuoteByInputToken, IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PoolUtil
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';
import { SolanaController } from '../../solana/solana.controller';

export class GetSwapQuoteController extends OrcaController {
  async getSwapQuote(
    inputTokenSymbol: string,
    outputTokenSymbol: string,
    amount: number,
    slippagePct?: number,
    tickSpacing?: number
  ): Promise<{
    estimatedAmountIn: string;
    estimatedAmountOut: string;
    otherAmountThreshold: string;
  }> {
    await this.loadOrca();

    const solanaController = new SolanaController();
    const inputToken = await solanaController.getTokenBySymbol(inputTokenSymbol);
    const outputToken = await solanaController.getTokenBySymbol(outputTokenSymbol);

    if (!inputToken || !outputToken) {
      throw new Error('Invalid token symbols');
    }

    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    const tick_spacing = tickSpacing || 64;  // Default 64 ticks

    // re-order tokens
    const [mintX, mintY] = PoolUtil.orderMints(inputToken.address, outputToken.address);

    const whirlpool_pubkey = PDAUtil.getWhirlpool(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      this.DEVNET_WHIRLPOOLS_CONFIG,
      new PublicKey(mintX),
      new PublicKey(mintY),
      tick_spacing
    ).publicKey;

    const whirlpool = await this.client.getPool(whirlpool_pubkey);

    const amount_in = new Decimal(amount);

    const quote = await swapQuoteByInputToken(
      whirlpool,
      new PublicKey(inputToken.address),
      DecimalUtil.toBN(amount_in, inputToken.decimals),
      slippage,
      ORCA_WHIRLPOOL_PROGRAM_ID,
      this.ctx.fetcher,
      IGNORE_CACHE,
    );

    return {
      estimatedAmountIn: DecimalUtil.fromBN(quote.estimatedAmountIn, inputToken.decimals).toString(),
      estimatedAmountOut: DecimalUtil.fromBN(quote.estimatedAmountOut, outputToken.decimals).toString(),
      otherAmountThreshold: DecimalUtil.fromBN(quote.otherAmountThreshold, outputToken.decimals).toString(),
    };
  }
}

export default function getSwapQuoteRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetSwapQuoteController();

  fastify.get(`/${folderName}/quote-swap`, {
    schema: {
      tags: [folderName],
      description: 'Get a swap quote for Orca',
      querystring: Type.Object({
        inputTokenSymbol: Type.String(),
        outputTokenSymbol: Type.String(),
        amount: Type.Number(),
        slippagePct: Type.Optional(Type.Number({ default: 1, minimum: 0, maximum: 100 })),
        tickSpacing: Type.Optional(Type.Number({ default: 64 })),
      }),
      response: {
        200: Type.Object({
          estimatedAmountIn: Type.String(),
          estimatedAmountOut: Type.String(),
          otherAmountThreshold: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { inputTokenSymbol, outputTokenSymbol, amount, slippagePct, tickSpacing } = request.query as {
        inputTokenSymbol: string;
        outputTokenSymbol: string;
        amount: number;
        slippagePct?: number;
        tickSpacing?: number;
      };
      fastify.log.info(`Getting Orca swap quote for ${inputTokenSymbol} to ${outputTokenSymbol}`);
      const quote = await controller.getSwapQuote(inputTokenSymbol, outputTokenSymbol, amount, slippagePct, tickSpacing);
      return quote;
    }
  });
}
