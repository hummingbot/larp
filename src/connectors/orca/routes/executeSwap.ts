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
import { GetBalanceController } from '../../solana/routes/getBalance';

class ExecuteSwapController extends OrcaController {
  async executeSwap(
    inputTokenSymbol: string,
    outputTokenSymbol: string,
    amount: number,
    tickSpacing: number,
    slippagePct?: number
  ): Promise<{ 
    signature: string;
    inputTokenBefore: string;
    inputTokenAfter: string;
    outputTokenBefore: string;
    outputTokenAfter: string;
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
      : Percentage.fromFraction(10, 1000); // Default 1% slippage

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

    console.log("estimatedAmountIn:", DecimalUtil.fromBN(quote.estimatedAmountIn, inputToken.decimals).toString(), "inputToken");
    console.log("estimatedAmountOut:", DecimalUtil.fromBN(quote.estimatedAmountOut, outputToken.decimals).toString(), "outputToken");
    console.log("otherAmountThreshold:", DecimalUtil.fromBN(quote.otherAmountThreshold, outputToken.decimals).toString(), "outputToken");

    const balanceController = new GetBalanceController();
    const getBalance = async (tokenAddress: string) => {
      const balances = JSON.parse(await balanceController.getBalance());
      const tokenBalance = balances.find(b => b.mint === tokenAddress);
      return tokenBalance ? tokenBalance.uiAmount : '0';
    };

    const inputTokenBefore = await getBalance(inputToken.address);
    const outputTokenBefore = await getBalance(outputToken.address);

    const tx = await whirlpool.swap(quote);
    const signature = await tx.buildAndExecute();
    console.log("signature:", signature);

    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, 'processed');

    const inputTokenAfter = await getBalance(inputToken.address);
    const outputTokenAfter = await getBalance(outputToken.address);

    return { 
      signature,
      inputTokenBefore: `${inputTokenSymbol} (before swap): ${inputTokenBefore}`,
      inputTokenAfter: `${inputTokenSymbol} (after swap): ${inputTokenAfter}`,
      outputTokenBefore: `${outputTokenSymbol} (before swap): ${outputTokenBefore}`,
      outputTokenAfter: `${outputTokenSymbol} (after swap): ${outputTokenAfter}`
    };
  }
}

export default function executeSwapRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new ExecuteSwapController();

  fastify.post(`/${folderName}/execute-swap`, {
    schema: {
      tags: [folderName],
      description: 'Execute a swap on Orca',
      body: Type.Object({
        inputTokenSymbol: Type.String(),
        outputTokenSymbol: Type.String(),
        amount: Type.Number(),
        tickSpacing: Type.Number({ default: 64 }),
        slippagePct: Type.Optional(Type.Number({ default: 1, minimum: 0, maximum: 100 })),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
          inputTokenBefore: Type.String(),
          inputTokenAfter: Type.String(),
          outputTokenBefore: Type.String(),
          outputTokenAfter: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { inputTokenSymbol, outputTokenSymbol, amount, tickSpacing, slippagePct } = request.body as {
        inputTokenSymbol: string;
        outputTokenSymbol: string;
        amount: number;
        tickSpacing: number;
        slippagePct?: number;
      };
      fastify.log.info(`Executing Orca swap from ${inputTokenSymbol} to ${outputTokenSymbol}`);
      const result = await controller.executeSwap(inputTokenSymbol, outputTokenSymbol, amount, tickSpacing, slippagePct);
      return result;
    }
  });
}