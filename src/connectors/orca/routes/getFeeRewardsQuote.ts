import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from "@solana/web3.js";
import {
  collectFeesQuote, collectRewardsQuote, TickArrayUtil, PDAUtil, PoolUtil,
  TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';
import { SolanaController } from '../../solana/solana.controller';

export const QuoteFeeRewardsResponse = Type.Object({
  tokenA: Type.Object({
    address: Type.String(),
    amount: Type.String(),
  }),
  tokenB: Type.Object({
    address: Type.String(),
    amount: Type.String(),
  }),
  rewards: Type.Array(Type.Object({
    address: Type.String(),
    amount: Type.String(),
  })),
});

class GetFeeRewardsQuoteController extends OrcaController {
  private feeRewardsQuoteValidator = TypeCompiler.Compile(QuoteFeeRewardsResponse);
  private solanaController: SolanaController;

  constructor() {
    super();
    this.solanaController = new SolanaController();
  }

  async getFeeRewardsQuote(
    positionAddress: string
  ): Promise<string> {
    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    console.log("position address:", position_pubkey.toBase58());

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(positionAddress);
    const whirlpool_pubkey = position.getData().whirlpool;
    const whirlpool = await this.client.getPool(whirlpool_pubkey);

    // Get TickArray and Tick
    const tick_spacing = whirlpool.getData().tickSpacing;
    const tick_array_lower_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickLowerIndex, tick_spacing, whirlpool_pubkey, this.ctx.program.programId).publicKey;
    const tick_array_upper_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickUpperIndex, tick_spacing, whirlpool_pubkey, this.ctx.program.programId).publicKey;
    const tick_array_lower = await this.ctx.fetcher.getTickArray(tick_array_lower_pubkey);
    const tick_array_upper = await this.ctx.fetcher.getTickArray(tick_array_upper_pubkey);
    const tick_lower = TickArrayUtil.getTickFromArray(tick_array_lower, position.getData().tickLowerIndex, tick_spacing);
    const tick_upper = TickArrayUtil.getTickFromArray(tick_array_upper, position.getData().tickUpperIndex, tick_spacing);

    // Get token info for TokenExtensions
    const tokenExtensionCtx = await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool.getData());

    // Get trade fee
    const quote_fee = await collectFeesQuote({
      whirlpool: whirlpool.getData(),
      position: position.getData(),
      tickLower: tick_lower,
      tickUpper: tick_upper,
      tokenExtensionCtx,
    });

    // Get rewards
    const quote_reward = await collectRewardsQuote({
      whirlpool: whirlpool.getData(),
      position: position.getData(),
      tickLower: tick_lower,
      tickUpper: tick_upper,
      tokenExtensionCtx,
    });

    const tokenA = whirlpool.getTokenAInfo();
    const tokenB = whirlpool.getTokenBInfo();

    const feeRewardsQuote = {
      tokenA: {
        address: tokenA.mint.toBase58(),
        amount: DecimalUtil.adjustDecimals(new Decimal(quote_fee.feeOwedA.toString()), tokenA.decimals).toString()
      },
      tokenB: {
        address: tokenB.mint.toBase58(),
        amount: DecimalUtil.adjustDecimals(new Decimal(quote_fee.feeOwedB.toString()), tokenB.decimals).toString()
      },
      rewards: await Promise.all(quote_reward.rewardOwed.map(async (reward, i) => {
        const reward_info = whirlpool.getData().rewardInfos[i];
        if (PoolUtil.isRewardInitialized(reward_info)) {
          const rewardToken = await this.solanaController.getTokenByAddress(reward_info.mint.toBase58());
          return {
            address: reward_info.mint.toBase58(),
            amount: DecimalUtil.adjustDecimals(new Decimal(reward.toString()), rewardToken.decimals).toString()
          };
        }
        return null;
      })).then(results => results.filter(Boolean))
    };

    // Validate the feeRewardsQuote object against the schema
    if (!this.feeRewardsQuoteValidator.Check(feeRewardsQuote)) {
      throw new Error('Fee and rewards quote does not match the expected schema');
    }

    return JSON.stringify(feeRewardsQuote);
  }
}

export default function getFeeRewardsQuoteRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetFeeRewardsQuoteController();

  fastify.get(`/${folderName}/fee-rewards-quote/:positionAddress`, {
    schema: {
      tags: [folderName],
      description: 'Get the fees and rewards quote for an Orca position',
      params: Type.Object({
        positionAddress: Type.String(),
      }),
      response: {
        200: QuoteFeeRewardsResponse
      },
    },
    handler: async (request, reply) => {
      const { positionAddress } = request.params as { positionAddress: string };
      fastify.log.info(`Getting fees and rewards quote for Orca position: ${positionAddress}`);
      const result = await controller.getFeeRewardsQuote(positionAddress);
      return result;
    }
  });
}