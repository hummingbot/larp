import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from "@solana/web3.js";
import {
  collectFeesQuote, TickArrayUtil, PDAUtil, PoolUtil,
  TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { OrcaController } from '../orca.controller';

export const FeesQuoteSchema = Type.Object({
  tokenA: Type.Object({
    address: Type.String(),
    amount: Type.String(),
  }),
  tokenB: Type.Object({
    address: Type.String(),
    amount: Type.String(),
  }),
});

class GetFeesQuoteController extends OrcaController {
  private feesQuoteValidator = TypeCompiler.Compile(FeesQuoteSchema);

  async getFeesQuote(
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

    const tokenA = whirlpool.getTokenAInfo();
    const tokenB = whirlpool.getTokenBInfo();

    const feesQuote = {
      tokenA: {
        address: tokenA.mint.toBase58(),
        amount: DecimalUtil.adjustDecimals(new Decimal(quote_fee.feeOwedA.toString()), tokenA.decimals).toString()
      },
      tokenB: {
        address: tokenB.mint.toBase58(),
        amount: DecimalUtil.adjustDecimals(new Decimal(quote_fee.feeOwedB.toString()), tokenB.decimals).toString()
      }
    };

    // Validate the feeQuote object against the schema
    if (!this.feesQuoteValidator.Check(feesQuote)) {
      throw new Error('Fee quote does not match the expected schema');
    }

    return JSON.stringify(feesQuote);
  }
}

export default function getFeesQuoteRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetFeesQuoteController();

  fastify.get(`/${folderName}/fees-quote/:positionAddress`, {
    schema: {
      tags: [folderName],
      description: 'Get the fees quote for an Orca position',
      params: Type.Object({
        positionAddress: Type.String(),
      }),
      response: {
        200: FeesQuoteSchema
      },
    },
    handler: async (request, reply) => {
      const { positionAddress } = request.params as { positionAddress: string };
      fastify.log.info(`Getting fees quote for Orca position: ${positionAddress}`);
      const result = await controller.getFeesQuote(positionAddress);
      return result;
    }
  });
}




