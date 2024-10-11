import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PublicKey } from "@solana/web3.js";
import {
  PDAUtil, PoolUtil, WhirlpoolIx, decreaseLiquidityQuoteByLiquidityWithParams,
  TokenExtensionUtil
} from "@orca-so/whirlpools-sdk";
import {
  Instruction, EMPTY_INSTRUCTION, resolveOrCreateATA, TransactionBuilder, Percentage,
  DecimalUtil
} from "@orca-so/common-sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OrcaController } from '../orca.controller';

class ClosePositionController extends OrcaController {
  async closePosition(positionAddress: string, slippagePct: number): Promise<string> {
    await this.loadOrca();

    const position_pubkey = new PublicKey(positionAddress);
    console.log("position address:", position_pubkey.toBase58());

    // Set slippage from parameter
    const slippage = Percentage.fromFraction(slippagePct * 10, 100);

    // Get the position and the pool to which the position belongs
    const position = await this.client.getPosition(position_pubkey);
    const position_owner = this.ctx.wallet.publicKey;
    const position_token_account = getAssociatedTokenAddressSync(position.getData().positionMint, position_owner);
    const whirlpool_pubkey = position.getData().whirlpool;
    const whirlpool = await this.client.getPool(whirlpool_pubkey);
    const whirlpool_data = whirlpool.getData();

    const token_a = whirlpool.getTokenAInfo();
    const token_b = whirlpool.getTokenBInfo();

    // Get TickArray and Tick
    const tick_spacing = whirlpool.getData().tickSpacing;
    const tick_array_lower_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickLowerIndex, tick_spacing, whirlpool_pubkey, this.ctx.program.programId).publicKey;
    const tick_array_upper_pubkey = PDAUtil.getTickArrayFromTickIndex(position.getData().tickUpperIndex, tick_spacing, whirlpool_pubkey, this.ctx.program.programId).publicKey;

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

    // Estimate the amount of tokens that can be withdrawn from the position
    const quote = decreaseLiquidityQuoteByLiquidityWithParams({
    // Pass the pool state as is
    sqrtPrice: whirlpool_data.sqrtPrice,
    tickCurrentIndex: whirlpool_data.tickCurrentIndex,
    // Pass the price range of the position as is
    tickLowerIndex: position.getData().tickLowerIndex,
    tickUpperIndex: position.getData().tickUpperIndex,
    // Liquidity to be withdrawn (All liquidity)
    liquidity: position.getData().liquidity,
    // Acceptable slippage
    slippageTolerance: slippage,
    // Get token info for TokenExtensions
    tokenExtensionCtx: await TokenExtensionUtil.buildTokenExtensionContext(this.ctx.fetcher, whirlpool_data),
    });

    // Output the estimation
    console.log("Token A min output:", DecimalUtil.fromBN(quote.tokenMinA, token_a.decimals).toFixed(token_a.decimals));
    console.log("Token B min output:", DecimalUtil.fromBN(quote.tokenMinB, token_b.decimals).toFixed(token_b.decimals));

    // Build the instruction to decrease liquidity
    const decrease_liquidity_ix = WhirlpoolIx.decreaseLiquidityIx(
      this.ctx.program,
      {
        ...quote,
        whirlpool: whirlpool_pubkey,
        position: position_pubkey,
        positionAuthority: position_owner,
        positionTokenAccount: position_token_account,
        tokenOwnerAccountA: token_account_map.get(token_a.mint.toBase58()),
        tokenOwnerAccountB: token_account_map.get(token_b.mint.toBase58()),
        tokenVaultA: whirlpool.getData().tokenVaultA, 
        tokenVaultB: whirlpool.getData().tokenVaultB,
        tickArrayLower: tick_array_lower_pubkey,
        tickArrayUpper: tick_array_upper_pubkey,
      }
    );  

    // Build the instruction to close the position
    const close_position_ix = WhirlpoolIx.closePositionIx(
      this.ctx.program,
      {
        position: position_pubkey,
        positionAuthority: position_owner,
        positionTokenAccount: position_token_account,
        positionMint: position.getData().positionMint,
        receiver: position_owner,
      }
    );

    // Create a transaction and add the instruction
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
      .addInstruction(close_position_ix);

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    return signature;
  }
}

export default function closePositionRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new ClosePositionController();

  fastify.post(`/${folderName}/close-position`, {
    schema: {
      tags: [folderName],
      description: 'Close an Orca position',
      querystring: Type.Object({
        positionAddress: Type.String(),
        slippagePct: Type.Optional(Type.Number({ default: 1, minimum: 0, maximum: 100 })),
      }),
      response: {
        200: Type.String()
      },
    },
    handler: async (request, reply) => {
      const { positionAddress, slippagePct = 1 } = request.query as { positionAddress: string; slippagePct?: number };
      fastify.log.info(`Closing Orca position: ${positionAddress} with slippage: ${slippagePct}%`);
      const result = await controller.closePosition(positionAddress, slippagePct);
      return result;
    }
  });
}