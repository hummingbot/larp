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
  private convertToDecimal(value: any, decimals?: number): string {
    return decimals !== undefined
      ? DecimalUtil.adjustDecimals(new Decimal(value.toString()), decimals).toString()
      : DecimalUtil.fromBN(value).toString();
  }

  async getPositions(address?: string, poolAddress?: string): Promise<PositionsOwnedByResponse> {
    if (!poolAddress) {
      throw new Error('Pool address is required');
    }

    const publicKey = address ? new PublicKey(address) : this.keypair.publicKey;

    try {
      const dlmmPool = await this.getDlmmPool(poolAddress);
      await dlmmPool.refetchStates();

      const { activeBin, userPositions } = await dlmmPool.getPositionsByUserAndLbPair(publicKey);

      const adjustedActiveBin = {
        ...activeBin,
        xAmount: this.convertToDecimal(activeBin.xAmount, dlmmPool.tokenX.decimal) as any,
        yAmount: this.convertToDecimal(activeBin.yAmount, dlmmPool.tokenY.decimal) as any,
      };

      const adjustedUserPositions = userPositions.map((position) => {
        const { positionData } = position;
        const tokenXDecimals = dlmmPool.tokenX.decimal;
        const tokenYDecimals = dlmmPool.tokenY.decimal;

        return {
          ...position,
          positionData: {
            ...positionData,
            positionBinData: positionData.positionBinData.map((binData) => ({
              ...binData,
              binXAmount: this.convertToDecimal(binData.binXAmount, tokenXDecimals),
              binYAmount: this.convertToDecimal(binData.binYAmount, tokenYDecimals),
              positionXAmount: this.convertToDecimal(binData.positionXAmount, tokenXDecimals),
              positionYAmount: this.convertToDecimal(binData.positionYAmount, tokenYDecimals),
            })),
            totalXAmount: this.convertToDecimal(positionData.totalXAmount, tokenXDecimals),
            totalYAmount: this.convertToDecimal(positionData.totalYAmount, tokenYDecimals),
            feeX: this.convertToDecimal(positionData.feeX, tokenXDecimals),
            feeY: this.convertToDecimal(positionData.feeY, tokenYDecimals),
            rewardOne: this.convertToDecimal(positionData.rewardOne, tokenXDecimals),
            rewardTwo: this.convertToDecimal(positionData.rewardTwo, tokenYDecimals),
            lastUpdatedAt: this.convertToDecimal(positionData.lastUpdatedAt),
          },
        };
      });

      return {
        activeBin: adjustedActiveBin,
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
        if (error.stack) {
          fastify.log.error(`Stack trace: ${error.stack}`);
        }
        reply.status(500).send({ error: `Failed to fetch positions: ${error.message}` });
      }
    },
  });
}
