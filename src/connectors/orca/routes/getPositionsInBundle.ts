import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from '@solana/web3.js';
import { PDAUtil, PositionBundleUtil, IGNORE_CACHE, PriceMath, PoolUtil } from "@orca-so/whirlpools-sdk";
import { DecimalUtil } from "@orca-so/common-sdk";
import { OrcaController } from '../orca.controller';
import { PositionInfoResponse, PositionInfoResponseSchema } from './getPositionInfo';
import { setTimeout } from 'timers/promises';

class GetPositionsInBundleController extends OrcaController {
  private positionInfoValidator = TypeCompiler.Compile(PositionInfoResponseSchema);

  private async processBatch(
    bundledPositionPubkeys: PublicKey[]
  ): Promise<PositionInfoResponse[]> {
    const batchPositionInfos = await Promise.all(bundledPositionPubkeys.map(async (pubkey) => {
      const position = await this.client.getPosition(pubkey, IGNORE_CACHE);
      if (!position) {
        console.warn(`Position not found for pubkey: ${pubkey.toBase58()}`);
        return null;
      }

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

      const positionInfo: PositionInfoResponse = {
        position: pubkey.toBase58(),
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

    // Filter out null values (positions that were not found)
    return batchPositionInfos.filter((info): info is PositionInfoResponse => info !== null);
  }

  async getPositionsInBundle(positionBundleAddress: string, indexes?: number[]): Promise<PositionInfoResponse[]> {
    await this.loadOrca();

    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    console.log("position bundle address:", position_bundle_pubkey.toBase58());

    // Get PositionBundle account
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey, IGNORE_CACHE);

    // Get the bundle indexes in use in PositionBundle
    let occupied_bundle_indexes = PositionBundleUtil.getOccupiedBundleIndexes(position_bundle);
    
    // If indexes are provided, filter occupied_bundle_indexes
    if (indexes && indexes.length > 0) {
      occupied_bundle_indexes = occupied_bundle_indexes.filter(index => indexes.includes(index));
    }
    
    console.log("occupied bundle indexes:", occupied_bundle_indexes);

    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 1000;
    const positionInfos: PositionInfoResponse[] = [];

    for (let i = 0; i < occupied_bundle_indexes.length; i += BATCH_SIZE) {
      const batchIndexes = occupied_bundle_indexes.slice(i, i + BATCH_SIZE);
      const bundledPositionPDAs = batchIndexes.map(index => 
        PDAUtil.getBundledPosition(this.ctx.program.programId, position_bundle.positionBundleMint, index)
      );

      const bundledPositionPubkeys = bundledPositionPDAs.map(pda => pda.publicKey);
      console.log(`Fetching positions for batch ${i / BATCH_SIZE + 1}:`, bundledPositionPubkeys.map(pk => pk.toBase58()));

      const batchPositionInfos = await this.processBatch(bundledPositionPubkeys);
      positionInfos.push(...batchPositionInfos);

      await setTimeout(DELAY_BETWEEN_BATCHES);
    }

    return positionInfos;
  }
}

export default function getPositionsInBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetPositionsInBundleController();

  fastify.get(`/${folderName}/positions-in-bundle/:bundleAddress`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve info about positions in an Orca position bundle',
      params: Type.Object({
        bundleAddress: Type.String()
      }),
      querystring: Type.Object({
        indexes: Type.Optional(Type.Array(Type.Integer()))
      }),
      response: {
        200: Type.Array(PositionInfoResponseSchema)
      }
    },
    handler: async (request, reply) => {
      const { bundleAddress } = request.params as { bundleAddress: string };
      const { indexes } = request.query as { indexes?: number[] };
      fastify.log.info(`Getting Orca positions for bundle address: ${bundleAddress}${indexes ? ` with indexes: ${indexes.join(', ')}` : ''}`);
      
      try {
        const positionsInfo = await controller.getPositionsInBundle(bundleAddress, indexes);
        reply.send(positionsInfo);
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