import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { QuoteResponse, SwapResponse } from "@jup-ag/api";
import { Wallet } from "@coral-xyz/anchor";
import { JupiterController } from '../jupiter.controller';
import { transactionSenderAndConfirmationWaiter } from "../../../utils/transactionSender";
import { getSignature } from "../../../utils/getSignature";
import { GetSwapQuoteController } from './quoteSwap';

export class ExecuteSwapController extends JupiterController {
  constructor() {
    super();
  }

  async getSwapObj(wallet: Wallet, quote: QuoteResponse): Promise<SwapResponse> {
    const swapObj = await this.jupiterQuoteApi.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      },
    });
    return swapObj;
  }

  async executeSwap(
    inputTokenSymbol: string,
    outputTokenSymbol: string,
    amount: number,
    slippagePct?: number
  ): Promise<{ signature: string; transactionResponse: any }> {
    await this.loadJupiter();
    
    const quoteController = new GetSwapQuoteController();
    const quote = await quoteController.getQuote(inputTokenSymbol, outputTokenSymbol, amount, slippagePct);
    
    console.log("Wallet:", this.wallet.publicKey.toBase58());

    const swapObj = await this.getSwapObj(this.wallet, quote);

    const swapTransactionBuf = Buffer.from(swapObj.swapTransaction, "base64");
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    transaction.sign([this.wallet.payer]);
    const signature = getSignature(transaction);

    const { value: simulatedTransactionResponse } =
      await this.connection.simulateTransaction(transaction, {
        replaceRecentBlockhash: true,
        commitment: "processed",
      });
    const { err, logs } = simulatedTransactionResponse;

    if (err) {
      console.error("Simulation Error:");
      console.error({ err, logs });
      throw new Error("Transaction simulation failed");
    }

    const serializedTransaction = Buffer.from(transaction.serialize());
    const blockhash = transaction.message.recentBlockhash;

    const transactionResponse = await transactionSenderAndConfirmationWaiter({
      connection: this.connection,
      serializedTransaction,
      blockhashWithExpiryBlockHeight: {
        blockhash,
        lastValidBlockHeight: swapObj.lastValidBlockHeight,
      },
    });

    if (!transactionResponse) {
      throw new Error("Transaction not confirmed");
    }

    if (transactionResponse.meta?.err) {
      throw new Error(`Transaction error: ${JSON.stringify(transactionResponse.meta.err)}`);
    }

    return { signature, transactionResponse };
  }
}

export default function executeSwapRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new ExecuteSwapController();

  fastify.post(`/${folderName}/execute-swap`, {
    schema: {
      tags: [folderName],
      description: 'Execute a swap on Jupiter',
      body: Type.Object({
        inputTokenSymbol: Type.String(),
        outputTokenSymbol: Type.String(),
        amount: Type.Number(),
        slippagePct: Type.Optional(Type.Number({ default: 1, minimum: 0, maximum: 100 })),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
          transactionResponse: Type.Object({}),
        })
      }
    },
    handler: async (request, reply) => {
      const { inputTokenSymbol, outputTokenSymbol, amount, slippagePct } = request.body as {
        inputTokenSymbol: string;
        outputTokenSymbol: string;
        amount: number;
        slippagePct?: number;
      };
      fastify.log.info(`Executing Jupiter swap from ${inputTokenSymbol} to ${outputTokenSymbol}`);
      const result = await controller.executeSwap(inputTokenSymbol, outputTokenSymbol, amount, slippagePct);
      return result;
    }
  });
}