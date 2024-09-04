import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from "@solana/web3.js";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import {
  PDAUtil, swapQuoteByInputToken, IGNORE_CACHE, ORCA_WHIRLPOOL_PROGRAM_ID, PoolUtil
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';

class ExecuteSwapController extends OrcaController {
  async executeSwap(
    inputTokenAddress: string,
    outputTokenAddress: string,
    amount: number,
    tickSpacing: number,
    slippagePct?: number
  ): Promise<{ signature: string }> {
    await this.loadOrca();

    const inputToken = { mint: new PublicKey(inputTokenAddress), decimals: 6 }; // Assuming USDC-like decimals
    const outputToken = { mint: new PublicKey(outputTokenAddress), decimals: 9 }; // Assuming SAMO-like decimals

    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(10, 1000); // Default 1% slippage

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
      ORCA_WHIRLPOOL_PROGRAM_ID,
      this.ctx.fetcher,
      IGNORE_CACHE,
    );

    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, inputToken.decimals).toString(), "inputToken");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, outputToken.decimals).toString(), "outputToken");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, outputToken.decimals).toString(), "outputToken");

    const tx = await whirlpool.swap(quote);
    const signature = await tx.buildAndExecute();
    console.log("signature:", signature);

    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    return { signature };
  }
}

export default function executeSwapRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new ExecuteSwapController();

  fastify.post(`/${folderName}/execute-swap`, {
    schema: {
      tags: [folderName],
      description: 'Execute a swap on Orca',
      body: Type.Object({
        inputTokenAddress: Type.String(),
        outputTokenAddress: Type.String(),
        amount: Type.Number(),
        tickSpacing: Type.Number({ default: 64 }),
        slippagePct: Type.Optional(Type.Number({ default: 1, minimum: 0, maximum: 100 })),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { inputTokenAddress, outputTokenAddress, amount, tickSpacing, slippagePct } = request.body as {
        inputTokenAddress: string;
        outputTokenAddress: string;
        amount: number;
        tickSpacing: number;
        slippagePct?: number;
      };
      fastify.log.info(`Executing Orca swap from ${inputTokenAddress} to ${outputTokenAddress}`);
      const result = await controller.executeSwap(inputTokenAddress, outputTokenAddress, amount, tickSpacing, slippagePct);
      return result;
    }
  });
}