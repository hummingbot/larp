import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from '@solana/web3.js';
import { PriceMath } from "@orca-so/whirlpools-sdk";
import { OrcaController } from '../orca.controller';
import { SolanaController } from '../../solana/solana.controller';

export const PoolInfoResponse = Type.Object({
  address: Type.String(),
  tokenA: Type.String(),
  tokenB: Type.String(),
  tickSpacing: Type.Number(),
  feeRateBps: Type.Number(),
  liquidity: Type.String(),
  price: Type.String(),
  tokenAAmount: Type.String(),
  tokenBAmount: Type.String(),
});

class GetPoolInfoController extends OrcaController {
  private poolInfoValidator = TypeCompiler.Compile(PoolInfoResponse);
  private solanaController = new SolanaController();

  async getPoolInfo(poolAddress: string): Promise<typeof PoolInfoResponse.static> {
    await this.loadOrca();

    const poolPublicKey = new PublicKey(poolAddress);
    console.log("Pool address:", poolPublicKey.toBase58());

    // Get the pool
    const pool = await this.client.getPool(poolPublicKey);
    const data = pool.getData();

    const tokenA = pool.getTokenAInfo();
    const tokenB = pool.getTokenBInfo();
    const price = PriceMath.sqrtPriceX64ToPrice(data.sqrtPrice, tokenA.decimals, tokenB.decimals);

    const tokenVaultA = pool.getTokenVaultAInfo();
    const tokenVaultB = pool.getTokenVaultBInfo();

    const tokenAAmount = await this.connection.getTokenAccountBalance(tokenVaultA.address);
    const tokenBAmount = await this.connection.getTokenAccountBalance(tokenVaultB.address);

    // Look up token symbols using SolanaController
    const tokenAInfo = await this.solanaController.getTokenByAddress(tokenA.address.toString());
    const tokenBInfo = await this.solanaController.getTokenByAddress(tokenB.address.toString());

    const poolInfo = {
      address: poolPublicKey.toBase58(),
      tokenA: tokenAInfo.symbol,
      tokenB: tokenBInfo.symbol,
      tickSpacing: data.tickSpacing,
      feeRateBps: data.feeRate / 100,
      liquidity: data.liquidity.toString(),
      price: price.toFixed(tokenB.decimals),
      tokenAAmount: (Number(tokenAAmount.value.amount) / Math.pow(10, tokenA.decimals)).toString(),
      tokenBAmount: (Number(tokenBAmount.value.amount) / Math.pow(10, tokenB.decimals)).toString(),
    };

    // Validate the poolInfo object against the schema
    if (!this.poolInfoValidator.Check(poolInfo)) {
      throw new Error('Pool info does not match the expected schema');
    }

    // Return the poolInfo object directly
    return poolInfo;
  }
}

export default function getPoolInfoRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetPoolInfoController();

  fastify.get(`/${folderName}/pool/:poolAddress`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve info about an Orca pool',
      params: Type.Object({
        poolAddress: Type.String()
      }),
      response: {
        200: PoolInfoResponse
      }
    },
    handler: async (request, reply) => {
      const { poolAddress } = request.params as { poolAddress: string };
      fastify.log.info(`Getting Orca pool info for address: ${poolAddress}`);
      
      try {
        const poolInfo = await controller.getPoolInfo(poolAddress);
        reply.send(poolInfo); // Send the object directly, no need to parse
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while fetching pool info'
        });
      }
    }
  });
}