import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { BinLiquidity } from '@meteora-ag/dlmm';
import { MeteoraController } from '../meteora.controller';
import { PublicKey } from '@solana/web3.js';
import { DecimalUtil } from '@orca-so/common-sdk';
import Decimal from 'decimal.js';

interface PositionsOwnedByResponse {
  activeBin: BinLiquidity;
  userPositions: Array<any>;
}

class PositionsOwnedController extends MeteoraController {
  async getPositions(address?: string, poolAddress?: string): Promise<PositionsOwnedByResponse> {
    if (!poolAddress) {
      throw new Error('Pool address is required');
    }

    const publicKey = address ? new PublicKey(address) : this.keypair.publicKey;

    try {
      const dlmmPool = await this.getDlmmPool(poolAddress);
      await dlmmPool.refetchStates();

      const { activeBin, userPositions } = await dlmmPool.getPositionsByUserAndLbPair(publicKey);

      const adjustedUserPositions = userPositions.map((position) => {
        const adjustedTotalXAmount = DecimalUtil.adjustDecimals(
          new Decimal(position.positionData.totalXAmount.toString()),
          dlmmPool.tokenX.decimal,
        ).toString();

        const adjustedTotalYAmount = DecimalUtil.adjustDecimals(
          new Decimal(position.positionData.totalYAmount.toString()),
          dlmmPool.tokenY.decimal,
        ).toString();

        const adjustedFeeX = DecimalUtil.fromBN(
          position.positionData.feeX,
          dlmmPool.tokenX.decimal,
        ).toString();

        const adjustedFeeY = DecimalUtil.fromBN(
          position.positionData.feeY,
          dlmmPool.tokenY.decimal,
        ).toString();

        const adjustlastUpdatedAt = DecimalUtil.fromBN(
          position.positionData.lastUpdatedAt,
        ).toString();

        const adjustedRewardOne = DecimalUtil.fromBN(
          position.positionData.rewardOne,
          dlmmPool.tokenX.decimal,
        ).toString();

        const adjustedRewardTwo = DecimalUtil.fromBN(
          position.positionData.rewardTwo,
          dlmmPool.tokenY.decimal,
        ).toString();

        return {
          ...position,
          positionData: {
            ...position.positionData,
            totalXAmount: adjustedTotalXAmount,
            totalYAmount: adjustedTotalYAmount,
            feeX: adjustedFeeX,
            feeY: adjustedFeeY,
            rewardOne: adjustedRewardOne,
            rewardTwo: adjustedRewardTwo,
            lastUpdatedAt: adjustlastUpdatedAt,
          },
        };
      });

      return {
        activeBin,
        userPositions: adjustedUserPositions,
      };
    } catch (error) {
      console.error('Error fetching user positions:', error);
      throw new Error('Failed to fetch user positions');
    }
  }
}

export default function getPositionsOwnedByRoute(
  fastify: FastifyInstance,
  folderName: string,
): void {
  const controller = new PositionsOwnedController();

  fastify.get(`/${folderName}/positions-owned`, {
    schema: {
      tags: [folderName],
      description: "Retrieve a list of Meteora positions owned by the user's wallet",
      querystring: Type.Object({
        poolAddress: Type.String(),
        address: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          activeBin: Type.Any(),
          userPositions: Type.Array(Type.Any()),
        }),
      },
    },
    handler: async (request, reply) => {
      const { address, poolAddress } = request.query as { poolAddress: string; address?: string };
      fastify.log.info(`Getting Meteora positions for ${address || 'user wallet'}`);

      try {
        const positions = await controller.getPositions(address, poolAddress);
        return positions;
      } catch (error) {
        fastify.log.error(`Error fetching positions: ${error.message}`);
        reply.status(500).send({ error: `Failed to fetch positions: ${error.message}` });
      }
    },
  });
}
