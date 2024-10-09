import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import {
  PDAUtil, PriceMath, ORCA_WHIRLPOOL_PROGRAM_ID,
  PositionBundleUtil, WhirlpoolIx, IGNORE_CACHE
} from "@orca-so/whirlpools-sdk";
import { TransactionBuilder } from "@orca-so/common-sdk";
import Decimal from "decimal.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OrcaController } from '../orca.controller';
import { SolanaController } from '../../solana/solana.controller';

class OpenPositionsInBundleController extends OrcaController {
  private async processBatch(
    priceRanges: { lower: Decimal; upper: Decimal }[],
    startIndex: number,
    unoccupiedBundleIndexes: number[],
    whirlpoolData: any,
    tokenA: any,
    tokenB: any,
    positionBundlePubkey: PublicKey,
    positionBundleTokenAccount: PublicKey,
    whirlpoolPubkey: PublicKey,
    positionBundleMint: PublicKey  // Add this parameter
  ): Promise<{ signature: string; bundledPositions: string[] }> {
    const open_bundled_position_ixs = priceRanges.map((range, index) => {
      const bundled_position_pda = PDAUtil.getBundledPosition(
        this.ctx.program.programId,
        positionBundleMint,  // Use this instead of whirlpoolData.positionBundleMint
        unoccupiedBundleIndexes[startIndex + index]
      );

      const lower_tick_index = PriceMath.priceToInitializableTickIndex(
        range.lower,
        tokenA.decimals,
        tokenB.decimals,
        whirlpoolData.tickSpacing
      );
      const upper_tick_index = PriceMath.priceToInitializableTickIndex(
        range.upper,
        tokenA.decimals,
        tokenB.decimals,
        whirlpoolData.tickSpacing
      );

      return {
        instruction: WhirlpoolIx.openBundledPositionIx(
          this.ctx.program,
          {
            funder: this.ctx.wallet.publicKey,
            positionBundle: positionBundlePubkey,
            positionBundleAuthority: this.ctx.wallet.publicKey,
            positionBundleTokenAccount: positionBundleTokenAccount,
            bundleIndex: unoccupiedBundleIndexes[startIndex + index],
            bundledPositionPda: bundled_position_pda,
            whirlpool: whirlpoolPubkey,
            tickLowerIndex: lower_tick_index,
            tickUpperIndex: upper_tick_index,
          },
        ),
        pda: bundled_position_pda
      };
    });

    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    open_bundled_position_ixs.forEach(({ instruction }) => tx_builder.addInstruction(instruction));

    const signature = await tx_builder.buildAndExecute();
    console.log(`Batch signature:`, signature);

    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    return {
      signature,
      bundledPositions: open_bundled_position_ixs.map(({ pda }) => pda.publicKey.toBase58()),
    };
  }

  async openPositionsInBundle(
    baseSymbol: string,
    quoteSymbol: string,
    tickSpacing: number,
    lowerPrice: Decimal,
    upperPrice: Decimal,
    positionBundleAddress: string,
    numberOfPositions: number
  ): Promise<{ signatures: string[]; bundledPositions: string[] }> {
    await this.loadOrca();

    const solanaController = new SolanaController();
    const baseToken = await solanaController.getTokenBySymbol(baseSymbol);
    const quoteToken = await solanaController.getTokenBySymbol(quoteSymbol);

    if (!baseToken || !quoteToken) {
      throw new Error('Invalid token symbols');
    }

    // Get whirlpool
    const whirlpool_pubkey = PDAUtil.getWhirlpool(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      this.WHIRLPOOL_CONFIG_ADDRESS,
      new PublicKey(baseToken.address),
      new PublicKey(quoteToken.address),
      tickSpacing
    ).publicKey;
    console.log("whirlpool_key:", whirlpool_pubkey.toBase58());
    const whirlpool = await this.client.getPool(whirlpool_pubkey);
    const whirlpool_data = whirlpool.getData();

    // Get the current price of the pool
    const sqrt_price_x64 = whirlpool.getData().sqrtPrice;
    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();
    const price = PriceMath.sqrtPriceX64ToPrice(sqrt_price_x64, token_a.decimals, token_b.decimals);
    console.log("price:", price.toFixed(token_b.decimals));

    // Adjust price range
    const priceDelta = upperPrice.sub(lowerPrice);
    const stepSize = priceDelta.div(numberOfPositions);
    const priceRanges = Array(numberOfPositions).fill(null).map((_, i) => ({
      lower: lowerPrice.add(stepSize.mul(i)),
      upper: lowerPrice.add(stepSize.mul(i + 1))
    }));
    console.log("Price ranges:", priceRanges.map(range => `${range.lower.toFixed(token_b.decimals)} - ${range.upper.toFixed(token_b.decimals)}`));

    // Get PositionBundle account
    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey, IGNORE_CACHE);

    // Get ATA for PositionBundle
    const position_bundle_token_account = getAssociatedTokenAddressSync(position_bundle.positionBundleMint, this.ctx.wallet.publicKey);

    // Get unused bundle indexes in PositionBundle
    const unoccupied_bundle_indexes = PositionBundleUtil.getUnoccupiedBundleIndexes(position_bundle);
    console.log(`Unoccupied bundle indexes (first ${numberOfPositions}):`, unoccupied_bundle_indexes.slice(0, numberOfPositions));

    const BATCH_SIZE = 10;
    const signatures: string[] = [];
    const bundledPositions: string[] = [];

    for (let i = 0; i < numberOfPositions; i += BATCH_SIZE) {
      const batchPriceRanges = priceRanges.slice(i, Math.min(i + BATCH_SIZE, numberOfPositions));
      const batchResult = await this.processBatch(
        batchPriceRanges,
        i,
        unoccupied_bundle_indexes,
        whirlpool_data,
        token_a,
        token_b,
        position_bundle_pubkey,
        position_bundle_token_account,
        whirlpool_pubkey,
        position_bundle.positionBundleMint  // Add this parameter
      );

      signatures.push(batchResult.signature);
      bundledPositions.push(...batchResult.bundledPositions);
    }

    return { signatures, bundledPositions };
  }
}

export default function openPositionsInBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new OpenPositionsInBundleController();

  fastify.post(`/${folderName}/open-positions-in-bundle`, {
    schema: {
      tags: [folderName],
      description: 'Open multiple new bundled Orca positions',
      body: Type.Object({
        baseSymbol: Type.String({ default: 'devSAMO' }),
        quoteSymbol: Type.String({ default: 'devUSDC' }),
        tickSpacing: Type.Number({ default: 64 }),
        lowerPrice: Type.String({ default: '0.005' }),
        upperPrice: Type.String({ default: '0.02' }),
        positionBundleAddress: Type.String(),
        numberOfPositions: Type.Number({ default: 2, minimum: 1 }),
      }),
      response: {
        200: Type.Object({
          signatures: Type.Array(Type.String()),
          bundledPositions: Type.Array(Type.String()),
        })
      }
    },
    handler: async (request, reply) => {
      const { baseSymbol, quoteSymbol, tickSpacing, lowerPrice, upperPrice, positionBundleAddress, numberOfPositions } = request.body as {
        baseSymbol: string;
        quoteSymbol: string;
        tickSpacing: number;
        lowerPrice: string;
        upperPrice: string;
        positionBundleAddress: string;
        numberOfPositions: number;
      };
      fastify.log.info(`Opening ${numberOfPositions} new bundled Orca positions: ${baseSymbol}/${quoteSymbol}`);
      const result = await controller.openPositionsInBundle(
        baseSymbol,
        quoteSymbol,
        tickSpacing,
        new Decimal(lowerPrice),
        new Decimal(upperPrice),
        positionBundleAddress,
        numberOfPositions
      );
      return result;
    }
  });
}