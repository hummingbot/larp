import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from "@solana/web3.js";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  PDAUtil, swapQuoteByInputToken, IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PoolUtil
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';

class GetSwapQuoteController extends OrcaController {
  async getSwapQuote(
    inputTokenAddress: string,
    outputTokenAddress: string,
    amount: string,
    slippagePct?: number,
    tickSpacing?: number
  ): Promise<{
    estimatedAmountIn: string;
    estimatedAmountOut: string;
    otherAmountThreshold: string;
  }> {
    await this.loadOrca();

    const inputToken = { mint: new PublicKey(inputTokenAddress), decimals: 6 }; // Assuming USDC-like decimals
    const outputToken = { mint: new PublicKey(outputTokenAddress), decimals: 9 }; // Assuming SAMO-like decimals


    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    const tick_spacing = tickSpacing || 64;  // Default 64 ticks

    // re-order tokens
    const [mintX, mintY] = PoolUtil.orderMints(inputTokenAddress, outputTokenAddress);

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
      inputToken.mint,
      DecimalUtil.toBN(amount_in, inputToken.decimals),
      slippage,
      this.ctx.program.programId,
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
        inputTokenAddress: Type.String(),
        outputTokenAddress: Type.String(),
        amount: Type.String(),
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
      const { inputTokenAddress, outputTokenAddress, amount, slippagePct, tickSpacing } = request.query as {
        inputTokenAddress: string;
        outputTokenAddress: string;
        amount: string;
        slippagePct?: number;
        tickSpacing?: number;
      };
      fastify.log.info(`Getting Orca swap quote for ${inputTokenAddress} to ${outputTokenAddress}`);
      const quote = await controller.getSwapQuote(inputTokenAddress, outputTokenAddress, amount, slippagePct, tickSpacing);
      return quote;
    }
  });
}
