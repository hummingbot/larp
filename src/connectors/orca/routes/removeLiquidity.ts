import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { BN } from "bn.js";
import {
  decreaseLiquidityQuoteByLiquidityWithParams,
  TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
import { OrcaController } from '../orca.controller';
import { GetPositionsController } from './getPositionInfo';
import { SolanaController } from '../../solana/solana.controller';

class RemoveLiquidityController extends OrcaController {
  private getPositionsController: GetPositionsController;

  constructor() {
    super();
    this.getPositionsController = new GetPositionsController();
  }

  async removeLiquidity(
    positionAddress: string,
    percentageToRemove: number,
    slippagePct?: number
  ): Promise<{
    baseToken: { address: string; chainId?: number; name: string; symbol: string; decimals: number; amountBefore: number; amountAfter: number };
    quoteToken: { address: string; chainId?: number; name: string; symbol: string; decimals: number; amountBefore: number; amountAfter: number };
    signature: string;
    liquidityBefore: string;
    liquidityAfter: string;
  }> {
    // Get position info before removing liquidity
    const positionInfoBefore = await this.getPositionsController.getPositionInfo(positionAddress);
    const baseTokenAmountBefore = positionInfoBefore.amountA;
    const quoteTokenAmountBefore = positionInfoBefore.amountB;

    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    console.log("position address:", position_pubkey.toBase58());

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const positionData = position.getData();
    const whirlpool = await this.client.getPool(positionData.whirlpool);

    // Get token info
    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();

    const solanaController = new SolanaController();
    const baseToken = await solanaController.getTokenByAddress(token_a.mint.toBase58());
    const quoteToken = await solanaController.getTokenByAddress(token_b.mint.toBase58());

    // Calculate the liquidity to be withdrawn
    const liquidityBefore = positionData.liquidity;
    const delta_liquidity = liquidityBefore.mul(new BN(percentageToRemove)).div(new BN(100));

    console.log("liquidity(before):", liquidityBefore.toString());
    console.log("liquidity to remove:", delta_liquidity.toString());

    const slippage = slippagePct
      ? Percentage.fromFraction(slippagePct * 100, 10000)
      : Percentage.fromFraction(1, 100); // Default 1% slippage

    // Obtain withdraw estimation
    const whirlpool_data = whirlpool.getData();
    const quote = decreaseLiquidityQuoteByLiquidityWithParams({
      // Pass the pool state as is
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      // Pass the price range of the position as is
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      // Liquidity to be withdrawn
      liquidity: delta_liquidity,
      // Acceptable slippage
      slippageTolerance: slippage,
      // Get token info for TokenExtensions
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });
    
    // Output the estimation
    console.log("Token A min output:", DecimalUtil.fromBN(quote.tokenMinA, token_a.decimals).toFixed(token_a.decimals));
    console.log("Token B min output:", DecimalUtil.fromBN(quote.tokenMinB, token_b.decimals).toFixed(token_b.decimals));

    // Create a transaction
    const decrease_liquidity_tx = await position.decreaseLiquidity(quote);

    // Send the transaction
    const signature = await decrease_liquidity_tx.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "finalized");

    // Get liquidity after transaction
    const updatedPosition = await position.refreshData();
    const liquidityAfter = updatedPosition.liquidity.toString();
    console.log("liquidity(after):", liquidityAfter);

    // Get position info after removing liquidity
    const positionInfoAfter = await this.getPositionsController.getPositionInfo(positionAddress);
    const baseTokenAmountAfter = positionInfoAfter.amountA;
    const quoteTokenAmountAfter = positionInfoAfter.amountB;

    console.log("Base token amount before:", baseTokenAmountBefore);
    console.log("Quote token amount before:", quoteTokenAmountBefore);
    console.log("Base token amount after:", baseTokenAmountAfter);
    console.log("Quote token amount after:", quoteTokenAmountAfter);

    return {
      baseToken: {
        ...baseToken,
        amountBefore: parseFloat(baseTokenAmountBefore),
        amountAfter: parseFloat(baseTokenAmountAfter),
      },
      quoteToken: {
        ...quoteToken,
        amountBefore: parseFloat(quoteTokenAmountBefore),
        amountAfter: parseFloat(quoteTokenAmountAfter),
      },
      signature,
      liquidityBefore: liquidityBefore.toString(),
      liquidityAfter,
    };
  }
}

export default function removeLiquidityRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new RemoveLiquidityController();

  fastify.post(`/${folderName}/remove-liquidity`, {
    schema: {
      tags: [folderName],
      description: 'Remove liquidity from an Orca position',
      body: Type.Object({
        positionAddress: Type.String(),
        percentageToRemove: Type.Number({ default: 30, minimum: 0, maximum: 100 }),
        slippagePct: Type.Optional(Type.Number({ default: 1 })),
      }),
      response: {
        200: Type.Object({
          baseToken: Type.Object({
            address: Type.String(),
            chainId: Type.Optional(Type.Number()),
            name: Type.String(),
            symbol: Type.String(),
            decimals: Type.Number(),
            amountBefore: Type.Number(),
            amountAfter: Type.Number(),
          }),
          quoteToken: Type.Object({
            address: Type.String(),
            chainId: Type.Optional(Type.Number()),
            name: Type.String(),
            symbol: Type.String(),
            decimals: Type.Number(),
            amountBefore: Type.Number(),
            amountAfter: Type.Number(),
          }),
          signature: Type.String(),
          liquidityBefore: Type.String(),
          liquidityAfter: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionAddress, percentageToRemove, slippagePct } = request.body as {
        positionAddress: string;
        percentageToRemove: number;
        slippagePct?: number;
      };
      fastify.log.info(`Removing liquidity from Orca position: ${positionAddress}`);
      const result = await controller.removeLiquidity(
        positionAddress,
        percentageToRemove,
        slippagePct
      );
      return result;
    }
  });
}
