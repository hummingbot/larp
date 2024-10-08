import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";  
import { BN } from "bn.js";
import { PDAUtil, IGNORE_CACHE, PriceMath, PoolUtil } from "@orca-so/whirlpools-sdk";
import { DecimalUtil } from "@orca-so/common-sdk";
import { OrcaController } from '../orca.controller';
import { PositionInfoResponse } from './getPositionInfo';

class PositionsOwnedController extends OrcaController {
  private positionInfoValidator = TypeCompiler.Compile(PositionInfoResponse);
  async getPositions(address?: string): Promise<typeof PositionInfoResponse[]> {
    await this.loadOrca();

    const publicKey = address ? new PublicKey(address) : this.ctx.wallet.publicKey;

    // Get all token accounts
    const tokenAccounts = (await this.ctx.connection.getTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })).value;

    // Get candidate addresses for the position
    const whirlpoolPositionCandidatePubkeys = tokenAccounts.map((ta) => {
      const parsed = unpackAccount(ta.pubkey, ta.account);
      const pda = PDAUtil.getPosition(this.ctx.program.programId, parsed.mint);
      return new BN(parsed.amount.toString()).eq(new BN(1)) ? pda.publicKey : undefined;
    }).filter(pubkey => pubkey !== undefined);

    // Get data from Whirlpool position addresses
    const whirlpool_position_candidate_datas = await this.ctx.fetcher.getPositions(whirlpoolPositionCandidatePubkeys, IGNORE_CACHE);
    // Leave only addresses with correct data acquisition as position addresses
    const whirlpool_positions = whirlpoolPositionCandidatePubkeys.filter((pubkey, i) => 
      whirlpool_position_candidate_datas[i] !== null
    );

    const positionInfos = [];
    // Output the status of the positions
    for (let i=0; i < whirlpool_positions.length; i++ ) {
      const p = whirlpool_positions[i];

      try {
        // Get the status of the position
        const position = await this.client.getPosition(p);
        const data = position.getData();

        // Get the pool to which the position belongs
        const pool = await this.client.getPool(data.whirlpool);
        const token_a = pool.getTokenAInfo();
        const token_b = pool.getTokenBInfo();
        const price = PriceMath.sqrtPriceX64ToPrice(pool.getData().sqrtPrice, token_a.decimals, token_b.decimals);

        // Get the price range of the position
        const lower_price = PriceMath.tickIndexToPrice(data.tickLowerIndex, token_a.decimals, token_b.decimals);
        const upper_price = PriceMath.tickIndexToPrice(data.tickUpperIndex, token_a.decimals, token_b.decimals);

        // Calculate the amount of tokens that can be withdrawn from the position
        const amounts = PoolUtil.getTokenAmountsFromLiquidity(
          data.liquidity,
          pool.getData().sqrtPrice,
          PriceMath.tickIndexToSqrtPriceX64(data.tickLowerIndex),
          PriceMath.tickIndexToSqrtPriceX64(data.tickUpperIndex),
          true
        );

        const positionInfo = {
          position: p.toBase58(),
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

        // Validate the positionInfo object against the schema
        if (!this.positionInfoValidator.Check(positionInfo)) {
          throw new Error('Position info does not match the expected schema');
        }

        positionInfos.push(positionInfo);
      } catch (error) {
        console.error(`Error fetching position at address ${p.toBase58()}:`, error);
        // Skip this position and continue with the next one
        continue;
      }
    }
    return positionInfos;
  }
}

export default function positionsOwnedRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new PositionsOwnedController();

  fastify.get(`/${folderName}/positions-owned`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve a list of Orca positions owned by an address or, if no address is provided, the user\'s wallet',
      querystring: Type.Object({
        address: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Array(PositionInfoResponse)
      }
    },
    handler: async (request, reply) => {
      const { address } = request.query as { address?: string };

      fastify.log.info(`Getting Orca positions for ${address || 'user wallet'}`);
      
      const positions = await controller.getPositions(address);
      return positions;
    }
  });
}