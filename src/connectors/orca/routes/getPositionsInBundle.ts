import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from '@solana/web3.js';
import { PDAUtil, PositionBundleUtil, IGNORE_CACHE, PriceMath, PoolUtil } from "@orca-so/whirlpools-sdk";
import { DecimalUtil } from "@orca-so/common-sdk";
import { OrcaController } from '../orca.controller';
import { PositionInfoResponse } from './getPositionInfo';

class GetPositionsInBundleController extends OrcaController {
  private positionInfoValidator = TypeCompiler.Compile(PositionInfoResponse);

  async getPositionsInBundle(positionBundleAddress: string): Promise<typeof PositionInfoResponse.static[]> {
    await this.loadOrca();

    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    console.log("position bundle address:", position_bundle_pubkey.toBase58());

    // Get PositionBundle account
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey, IGNORE_CACHE);

    // Get the bundle indexes in use in PositionBundle
    const occupied_bundle_indexes = PositionBundleUtil.getOccupiedBundleIndexes(position_bundle);
    console.log("occupied bundle indexes:", occupied_bundle_indexes);

    const positionInfos = await Promise.all(occupied_bundle_indexes.map(async (index) => {
      const bundled_position_pda = PDAUtil.getBundledPosition(this.ctx.program.programId, position_bundle.positionBundleMint, index);
      console.log(`bundled position ${index} pubkey:`, bundled_position_pda.publicKey.toBase58());

      // Use IGNORE_CACHE when fetching the position
      const position = await this.client.getPosition(bundled_position_pda.publicKey, IGNORE_CACHE);
      const data = position.getData();

      // Use IGNORE_CACHE when fetching the pool
      const pool = await this.client.getPool(data.whirlpool, IGNORE_CACHE);

      const token_a = pool.getTokenAInfo();
      const token_b = pool.getTokenBInfo();
      const price = PriceMath.sqrtPriceX64ToPrice(pool.getData().sqrtPrice, token_a.decimals, token_b.decimals);

      const lower_price = PriceMath.tickIndexToPrice(data.tickLowerIndex, token_a.decimals, token_b.decimals);
      const upper_price = PriceMath.tickIndexToPrice(data.tickUpperIndex, token_a.decimals, token_b.decimals);

      const amounts = PoolUtil.getTokenAmountsFromLiquidity(
        data.liquidity,
        pool.getData().sqrtPrice,
        PriceMath.tickIndexToSqrtPriceX64(data.tickLowerIndex),
        PriceMath.tickIndexToSqrtPriceX64(data.tickUpperIndex),
        true
      );

      const positionInfo = {
        position: bundled_position_pda.publicKey.toBase58(),
        whirlpoolAddress: data.whirlpool.toBase58(),
        whirlpoolPrice: price.toFixed(token_b.decimals),
        tokenA: token_a.mint.toBase58(),
        tokenB: token_b.mint.toBase58(),
        liquidity: data.liquidity.toString(),
        lower: {
          tickIndex: data.tickLowerIndex,
          price: lower_price.toFixed(token_b.decimals)
        },
        upper: {
          tickIndex: data.tickUpperIndex,
          price: upper_price.toFixed(token_b.decimals)
        },
        amountA: DecimalUtil.fromBN(amounts.tokenA, token_a.decimals).toString(),
        amountB: DecimalUtil.fromBN(amounts.tokenB, token_b.decimals).toString()
      };

      if (!this.positionInfoValidator.Check(positionInfo)) {
        throw new Error('Position info does not match the expected schema');
      }

      return positionInfo;
    }));

    return positionInfos; // Return the array directly, not stringified
  }
}

export default function getPositionsInBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetPositionsInBundleController();

  fastify.get(`/${folderName}/positions-in-bundle/:positionBundleAddress`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve info about all positions in an Orca position bundle',
      params: Type.Object({
        positionBundleAddress: Type.String()
      }),
      response: {
        200: Type.Array(PositionInfoResponse)
      }
    },
    handler: async (request, reply) => {
      const { positionBundleAddress } = request.params as { positionBundleAddress: string };
      fastify.log.info(`Getting Orca positions for bundle address: ${positionBundleAddress}`);
      
      try {
        const positionsInfo = await controller.getPositionsInBundle(positionBundleAddress);
        reply.send(positionsInfo); // Use reply.send() to let Fastify handle the serialization
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while fetching positions in bundle'
        });
      }
    }
  });
}