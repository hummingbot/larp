import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import {
  PDAUtil, PositionBundleUtil, decreaseLiquidityQuoteByLiquidityWithParams, PositionBundleData, PoolUtil, WhirlpoolIx,
  TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import { DecimalUtil, EMPTY_INSTRUCTION, Instruction, Percentage, TransactionBuilder, resolveOrCreateATA } from "@orca-so/common-sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OrcaController } from '../orca.controller';

class ClosePositionsInBundleController extends OrcaController {
  async closeSinglePosition(
    position_bundle_pubkey: PublicKey,
    position_bundle: PositionBundleData,
    bundle_index: number
  ): Promise<{ signature: string; closedPosition: string }> {
    await this.loadOrca();

    const bundled_position_pda = PDAUtil.getBundledPosition(this.ctx.program.programId, position_bundle.positionBundleMint, bundle_index);
    const bundled_position_pubkey = bundled_position_pda.publicKey;
    console.log(`bundled position (${bundle_index}) pubkey:`, bundled_position_pubkey.toBase58());

    // Set acceptable slippage
    const slippage = Percentage.fromFraction(10, 1000); // 1%

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(bundled_position_pubkey);
    const position_bundle_owner = this.ctx.wallet.publicKey;
    const position_bundle_token_account = getAssociatedTokenAddressSync(position.getData().positionMint, position_bundle_owner);
    const whirlpool_pubkey = position.getData().whirlpool;
    const whirlpool = await this.client.getPool(whirlpool_pubkey);
    const whirlpool_data = whirlpool.getData();

    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();

    // Get TickArray and Tick
    const tick_spacing = whirlpool.getData().tickSpacing;
    const tick_array_lower_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickLowerIndex, tick_spacing, whirlpool_pubkey, ctx.program.programId).publicKey;
    const tick_array_upper_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickUpperIndex, tick_spacing, whirlpool_pubkey, ctx.program.programId).publicKey;

    // Create token accounts to receive fees and rewards
    // Collect mint addresses of tokens to receive
    const tokens_to_be_collected = new Set<string>();
    tokens_to_be_collected.add(token_a.mint.toBase58());
    tokens_to_be_collected.add(token_b.mint.toBase58());
    whirlpool.getData().rewardInfos.map((reward_info) => {
      if ( PoolUtil.isRewardInitialized(reward_info) ) {
        tokens_to_be_collected.add(reward_info.mint.toBase58());
      }
    });

    // Get addresses of token accounts and get instructions to create if it does not exist
    const required_ta_ix: Instruction[] = [];
    const token_account_map = new Map<string, PublicKey>();
    for ( let mint_b58 of tokens_to_be_collected ) {
      const mint = new PublicKey(mint_b58);
      // If present, ix is EMPTY_INSTRUCTION
      const {address, ...ix} = await resolveOrCreateATA(
        this.ctx.connection,
        position_bundle_owner,
        mint,
        () => this.ctx.fetcher.getAccountRentExempt()
      );
      required_ta_ix.push(ix);
      token_account_map.set(mint_b58, address);
    }

    // Build the instruction to update fees and rewards
    let update_fee_and_rewards_ix = position.getData().liquidity.isZero()
      ? EMPTY_INSTRUCTION
      : WhirlpoolIx.updateFeesAndRewardsIx(
        this.ctx.program,
        {
          whirlpool: whirlpool_pubkey,
          position: bundled_position_pubkey,
          tickArrayLower: tick_array_lower_pubkey,
          tickArrayUpper: tick_array_upper_pubkey,
        }
      );

    let collect_fees_ix = WhirlpoolIx.collectFeesIx(this.ctx.program, {
      whirlpool: whirlpool_pubkey,
      position: bundled_position_pubkey,
      positionAuthority: this.ctx.wallet.publicKey,
      positionTokenAccount: position_bundle_token_account,
      tokenOwnerAccountA: token_account_map.get(token_a.mint.toBase58()),
      tokenOwnerAccountB: token_account_map.get(token_b.mint.toBase58()),
      tokenVaultA: whirlpool_data.tokenVaultA,
      tokenVaultB: whirlpool_data.tokenVaultB,
    });

    // Build the instructions to collect rewards
    const collect_reward_ix = [EMPTY_INSTRUCTION, EMPTY_INSTRUCTION, EMPTY_INSTRUCTION];
    for (let i=0; i<whirlpool.getData().rewardInfos.length; i++) {
      const reward_info = whirlpool.getData().rewardInfos[i];
      if ( !PoolUtil.isRewardInitialized(reward_info) ) continue;

      collect_reward_ix[i] = WhirlpoolIx.collectRewardIx(
        this.ctx.program,
        {
          whirlpool: whirlpool_pubkey,
          position: bundled_position_pubkey,
          positionAuthority: position_bundle_owner,
          positionTokenAccount: position_bundle_token_account,
          rewardIndex: i,
          rewardOwnerAccount: token_account_map.get(reward_info.mint.toBase58()),
          rewardVault: reward_info.vault,
        }
      );
    }

    // Estimate the amount of tokens that can be withdrawn from the position
    const quote = decreaseLiquidityQuoteByLiquidityWithParams({
      sqrtPrice: whirlpool_data.sqrtPrice,
      tickCurrentIndex: whirlpool_data.tickCurrentIndex,
      tickLowerIndex: position.getData().tickLowerIndex,
      tickUpperIndex: position.getData().tickUpperIndex,
      liquidity: position.getData().liquidity,
      slippageTolerance: slippage,
      tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });

    // Output the estimation
    console.log(`${token_a.mint.toBase58()} min output:`, DecimalUtil.fromBN(quote.tokenMinA, token_a.decimals).toFixed(token_a.decimals));
    console.log(`${token_b.mint.toBase58()} min output:`, DecimalUtil.fromBN(quote.tokenMinB, token_b.decimals).toFixed(token_b.decimals));

    // Build the instruction to decrease liquidity
    const decrease_liquidity_ix = position.getData().liquidity.isZero()
      ? EMPTY_INSTRUCTION
      : WhirlpoolIx.decreaseLiquidityIx(
        this.ctx.program,
        {
          ...quote,
          whirlpool: whirlpool_pubkey,
          position: bundled_position_pubkey,
          positionAuthority: position_bundle_owner,
          positionTokenAccount: position_bundle_token_account,
          tokenOwnerAccountA: token_account_map.get(token_a.mint.toBase58()),
          tokenOwnerAccountB: token_account_map.get(token_b.mint.toBase58()),
          tokenVaultA: whirlpool_data.tokenVaultA, 
          tokenVaultB: whirlpool_data.tokenVaultB,
          tickArrayLower: tick_array_lower_pubkey,
          tickArrayUpper: tick_array_upper_pubkey,
        }
      );

    // Build the instruction to close the position managed by PositionBundle
    const close_bundled_position_ix = WhirlpoolIx.closeBundledPositionIx(
      this.ctx.program, 
      {
        bundledPosition: bundled_position_pubkey,
        positionBundle: position_bundle_pubkey,
        positionBundleAuthority: position_bundle_owner,
        positionBundleTokenAccount: position_bundle_token_account,
        bundleIndex: bundle_index,
        receiver: position_bundle_owner,
      }
    );

    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    // Create token accounts
    required_ta_ix.map((ix) => tx_builder.addInstruction(ix));
    tx_builder
      // Update fees and rewards, collect fees, and collect rewards
      .addInstruction(update_fee_and_rewards_ix)
      .addInstruction(collect_fees_ix)
      .addInstruction(collect_reward_ix[0])
      .addInstruction(collect_reward_ix[1])
      .addInstruction(collect_reward_ix[2])
      // Decrease liquidity
      .addInstruction(decrease_liquidity_ix)
      // Close the position
      .addInstruction(close_bundled_position_ix);

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    return {
      signature,
      closedPosition: bundled_position_pubkey.toBase58(),
    };
  }

  async closePositionsInBundle(
    positionBundleAddress: string
  ): Promise<{ signature: string; closedPositions: string[] }> {
    await this.loadOrca();

    // Get PositionBundle account
    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey);

    // Get occupied bundle indexes in PositionBundle
    const occupied_bundle_indexes = PositionBundleUtil.getOccupiedBundleIndexes(position_bundle);
    console.log("Occupied bundle indexes:", occupied_bundle_indexes);

    const closedPositions: string[] = [];
    let lastSignature: string = '';

    for (const bundle_index of occupied_bundle_indexes) {
      const result = await this.closeSinglePosition(position_bundle_pubkey, position_bundle, bundle_index);
      closedPositions.push(result.closedPosition);
      lastSignature = result.signature;
    }

    return {
      signature: lastSignature,
      closedPositions,
    };
  }
}

export default function closePositionsInBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new ClosePositionsInBundleController();

  fastify.post(`/${folderName}/close-positions-in-bundle`, {
    schema: {
      tags: [folderName],
      description: 'Close all bundled Orca positions in a position bundle',
      body: Type.Object({
        positionBundleAddress: Type.String(),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
          closedPositions: Type.Array(Type.String()),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionBundleAddress } = request.body as {
        positionBundleAddress: string;
      };
      fastify.log.info(`Closing all bundled Orca positions in bundle: ${positionBundleAddress}`);
      const result = await controller.closePositionsInBundle(positionBundleAddress);
      return result;
    }
  });
}
