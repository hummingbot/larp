import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { RaydiumController } from '../raydium.controller';

class GetPoolInfoController extends RaydiumController {
  async getPoolInfo(poolAddress: string): Promise<{
    poolPrice: string;
    baseTokenAddress: string;
    quoteTokenAddress: string;
  }> {
    await this.loadRaydium();

    const res = await this.raydium.liquidity.getRpcPoolInfos([poolAddress]);
    const poolInfo = res[poolAddress];

    if (!poolInfo) {
      throw new Error("Pool not found");
    }

    return {
      poolPrice: poolInfo.poolPrice.toFixed(8), // Convert to string with 8 decimal places
      baseTokenAddress: poolInfo.baseMint.toString(),
      quoteTokenAddress: poolInfo.quoteMint.toString(),
    };
  }
}

export default function getPoolInfoRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetPoolInfoController();

  fastify.get(`/${folderName}/amm/pool/:poolAddress`, {
    schema: {
      tags: [folderName],
      description: 'Get info on a Raydium pool',
      params: Type.Object({
        poolAddress: Type.String()
      }),
      response: {
        200: Type.Object({
          poolPrice: Type.String(),
          baseTokenAddress: Type.String(),
          quoteTokenAddress: Type.String()
        })
      }
    },
    handler: async (request, reply) => {
      const { poolAddress } = request.params as { poolAddress: string };
      fastify.log.info(`Getting Raydium pool info for address: ${poolAddress}`);
      
      const poolInfo = await controller.getPoolInfo(poolAddress);
      return poolInfo;
    }
  });
}