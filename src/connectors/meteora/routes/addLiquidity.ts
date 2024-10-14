import { BN } from '@coral-xyz/anchor';
import { MeteoraController } from '../meteora.controller';
import DLMM, { LbPosition, StrategyType } from '@meteora-ag/dlmm';
import { FastifyInstance } from 'fastify';
import { MAX_ACTIVE_BIN_SLIPPAGE, PositionInfo } from '@meteora-ag/dlmm';
import { Type } from '@sinclair/typebox';
import { DecimalUtil } from '@orca-so/common-sdk';
import Decimal from 'decimal.js';

class AddLiquidityController extends MeteoraController {
  async addLiquidity(
    positionAddress: string,
    baseTokenAmount: number,
    quoteTokenAmount: number,
    slippagePct?: number,
  ): Promise<{
    signature: string;
    tokenXAddedAmount: number;
    tokenYAddedAmount: number;
    fee: number;
  }> {
    // Find all positions by users
    const allPositions = await DLMM.getAllLbPairPositionsByUser(
      this.connection,
      this.keypair.publicKey,
    );

    // Find the matching position info
    let matchingLbPosition: LbPosition;
    let matchingPositionInfo: PositionInfo;

    for (const position of allPositions.values()) {
      matchingLbPosition = position.lbPairPositionsData.find(
        (lbPosition) => lbPosition.publicKey.toBase58() === positionAddress,
      );
      if (matchingLbPosition) {
        matchingPositionInfo = position;
        break;
      }
    }

    if (!matchingLbPosition || !matchingPositionInfo) {
      console.error('Position not found');
      throw new Error('Position not found');
    }

    // Get requirement data
    const maxBinId = matchingLbPosition.positionData.upperBinId;
    const minBinId = matchingLbPosition.positionData.lowerBinId;

    const totalXAmount = new BN(
      DecimalUtil.toBN(new Decimal(baseTokenAmount), matchingPositionInfo.tokenX.decimal),
    );
    const totalYAmount = new BN(
      DecimalUtil.toBN(new Decimal(quoteTokenAmount), matchingPositionInfo.tokenY.decimal),
    );

    // Initialize DLMM pool using MeteoraController
    const dlmmPool = await this.getDlmmPool(matchingPositionInfo.publicKey.toBase58());

    await dlmmPool.refetchStates();

    const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
      positionPubKey: matchingLbPosition.publicKey,
      user: this.keypair.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: StrategyType.SpotImBalanced,
      },
      slippage: slippagePct ? slippagePct : MAX_ACTIVE_BIN_SLIPPAGE,
    });

    const signature = await this.sendAndConfirmTransaction(addLiquidityTx, [this.keypair]);

    const { balanceChange: tokenXAddedAmount, fee } = await this.extractTokenBalanceChangeAndFee(
      signature,
      dlmmPool.tokenX.publicKey.toBase58(),
      dlmmPool.pubkey.toBase58(),
    );

    const { balanceChange: tokenYAddedAmount } = await this.extractTokenBalanceChangeAndFee(
      signature,
      dlmmPool.tokenY.publicKey.toBase58(),
      dlmmPool.pubkey.toBase58(),
    );

    return {
      signature,
      tokenXAddedAmount: Math.abs(tokenXAddedAmount),
      tokenYAddedAmount: Math.abs(tokenYAddedAmount),
      fee,
    };
  }
}

export default function addLiquidityRoute(fastify: FastifyInstance, folderName: string): void {
  const controller = new AddLiquidityController();

  fastify.post(`/${folderName}/add-liquidity`, {
    schema: {
      tags: [folderName],
      description: 'Add liquidity to a Meteora position',
      body: Type.Object({
        positionAddress: Type.String({ default: '' }),
        baseTokenAmount: Type.Number({ default: 1 }),
        quoteTokenAmount: Type.Number({ default: 1 }),
        slippagePct: Type.Optional(Type.Number({ default: 1 })),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
          tokenXAddedAmount: Type.Number(),
          tokenYAddedAmount: Type.Number(),
          fee: Type.Number(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { positionAddress, baseTokenAmount, quoteTokenAmount, slippagePct } = request.body as {
        positionAddress: string;
        baseTokenAmount: number;
        quoteTokenAmount: number;
        slippagePct?: number;
      };
      fastify.log.info(`Adding liquidity to Meteora position: ${positionAddress}`);
      try {
        const result = await controller.addLiquidity(
          positionAddress,
          baseTokenAmount,
          quoteTokenAmount,
          slippagePct,
        );
        return result;
      } catch (error) {
        fastify.log.error(`Error adding liquidity: ${error.message}`);
        reply.status(500).send({ error: `Failed to add liquidity: ${error.message}` });
      }
    },
  });
}
