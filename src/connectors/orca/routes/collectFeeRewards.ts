import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from "@solana/web3.js";
import { PDAUtil, PoolUtil, WhirlpoolIx } from "@orca-so/whirlpools-sdk";
import {
  Instruction, EMPTY_INSTRUCTION, resolveOrCreateATA, TransactionBuilder
} from "@orca-so/common-sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OrcaController } from '../orca.controller';

const CollectFeeRewardsResponseSchema = Type.Object({
  signature: Type.String(),
});

class CollectFeeRewardsController extends OrcaController {
  private collectFeeRewardsResponseValidator = TypeCompiler.Compile(CollectFeeRewardsResponseSchema);

  async collectFeeRewards(positionAddress: string): Promise<string> {
    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    console.log("position address:", position_pubkey.toBase58());

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const position_owner = this.ctx.wallet.publicKey;
    const position_token_account = getAssociatedTokenAddressSync(position.getData().positionMint, position_owner);
    const whirlpool_pubkey = position.getData().whirlpool;
    const whirlpool = await this.client.getPool(whirlpool_pubkey);
    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();

    // Get TickArray and Tick
    const tick_spacing = whirlpool.getData().tickSpacing;
    const tick_array_lower_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickLowerIndex, tick_spacing, whirlpool_pubkey, this.ctx.program.programId).publicKey;
    const tick_array_upper_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickUpperIndex, tick_spacing, whirlpool_pubkey, this.ctx.program.programId).publicKey;

    // Create token accounts to receive fees and rewards
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
      const {address, ...ix} = await resolveOrCreateATA(
        this.ctx.connection,
        position_owner,
        mint,
        () => this.ctx.fetcher.getAccountRentExempt()
      );
      required_ta_ix.push(ix);
      token_account_map.set(mint_b58, address);
    }

    // Build the instruction to update fees and rewards
    let update_fee_and_rewards_ix = WhirlpoolIx.updateFeesAndRewardsIx(
      this.ctx.program,
      {
        whirlpool: position.getData().whirlpool,
        position: position_pubkey,
        tickArrayLower: tick_array_lower_pubkey,
        tickArrayUpper: tick_array_upper_pubkey,
      }
    );
    
    // Build the instruction to collect fees
    let collect_fees_ix = WhirlpoolIx.collectFeesIx(
      this.ctx.program,
      {
        whirlpool: whirlpool_pubkey,
        position: position_pubkey,
        positionAuthority: position_owner,
        positionTokenAccount: position_token_account,
        tokenOwnerAccountA: token_account_map.get(token_a.mint.toBase58()),
        tokenOwnerAccountB: token_account_map.get(token_b.mint.toBase58()),
        tokenVaultA: whirlpool.getData().tokenVaultA, 
        tokenVaultB: whirlpool.getData().tokenVaultB,
      }
    );

    // Build the instructions to collect rewards
    const collect_reward_ix = [EMPTY_INSTRUCTION, EMPTY_INSTRUCTION, EMPTY_INSTRUCTION];
    for (let i=0; i<whirlpool.getData().rewardInfos.length; i++) {
      const reward_info = whirlpool.getData().rewardInfos[i];
      if ( !PoolUtil.isRewardInitialized(reward_info) ) continue;

      collect_reward_ix[i] = WhirlpoolIx.collectRewardIx(
        this.ctx.program,
        {
          whirlpool: whirlpool_pubkey,
          position: position_pubkey,
          positionAuthority: position_owner,
          positionTokenAccount: position_token_account,
          rewardIndex: i,
          rewardOwnerAccount: token_account_map.get(reward_info.mint.toBase58()),
          rewardVault: reward_info.vault,
        }
      );
    }

    // Create a transaction and add the instructions
    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    required_ta_ix.map((ix) => tx_builder.addInstruction(ix));
    tx_builder
      .addInstruction(update_fee_and_rewards_ix)
      .addInstruction(collect_fees_ix)
      .addInstruction(collect_reward_ix[0])
      .addInstruction(collect_reward_ix[1])
      .addInstruction(collect_reward_ix[2]);

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    const response = { signature };

    // Validate the response object against the schema
    if (!this.collectFeeRewardsResponseValidator.Check(response)) {
      throw new Error('Collect fee rewards response does not match the expected schema');
    }

    return JSON.stringify(response);
  }
}

export default function collectFeeRewardsRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new CollectFeeRewardsController();

  fastify.post(`/${folderName}/collect-fee-rewards/:positionAddress`, {
    schema: {
      tags: [folderName],
      description: 'Collect fees and rewards for an Orca position',
      params: Type.Object({
        positionAddress: Type.String(),
      }),
      response: {
        200: CollectFeeRewardsResponseSchema
      },
    },
    handler: async (request, reply) => {
      const { positionAddress } = request.params as { positionAddress: string };
      fastify.log.info(`Collecting fees and rewards for Orca position: ${positionAddress}`);
      const result = await controller.collectFeeRewards(positionAddress);
      return result;
    }
  });
}
