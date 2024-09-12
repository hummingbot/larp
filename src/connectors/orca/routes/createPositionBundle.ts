import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { Keypair } from "@solana/web3.js";
import {
  PDAUtil, WhirlpoolIx, ORCA_WHIRLPOOL_PROGRAM_ID
} from "@orca-so/whirlpools-sdk";
import { TransactionBuilder } from "@orca-so/common-sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OrcaController } from '../orca.controller';

class CreatePositionBundleController extends OrcaController {
  async createPositionBundle(): Promise<{ signature: string; positionBundleMint: string; positionBundleAddress: string }> {
    await this.loadOrca();

    // Generate the address of Mint, PDA, and ATA for PositionBundle
    const position_bundle_mint_keypair = Keypair.generate();
    const position_bundle_pda = PDAUtil.getPositionBundle(ORCA_WHIRLPOOL_PROGRAM_ID, position_bundle_mint_keypair.publicKey);
    const position_bundle_token_account = getAssociatedTokenAddressSync(position_bundle_mint_keypair.publicKey, this.ctx.wallet.publicKey);

    // Build the instruction to initialize PositionBundle
    const initialize_position_bundle_ix = WhirlpoolIx.initializePositionBundleIx(
      this.ctx.program,
      {
        funder: this.ctx.wallet.publicKey,
        owner: this.ctx.wallet.publicKey,
        positionBundleMintKeypair: position_bundle_mint_keypair,
        positionBundlePda: position_bundle_pda,
        positionBundleTokenAccount: position_bundle_token_account,
      }
    );

    // Create a transaction
    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    tx_builder.addInstruction(initialize_position_bundle_ix);

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);
    console.log("position bundle NFT:", position_bundle_mint_keypair.publicKey.toBase58());
    console.log("position bundle address:", position_bundle_pda.publicKey.toBase58());

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    return {
      signature,
      positionBundleMint: position_bundle_mint_keypair.publicKey.toBase58(),
      positionBundleAddress: position_bundle_pda.publicKey.toBase58(),
    };
  }
}

export default function createPositionBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new CreatePositionBundleController();

  fastify.post(`/${folderName}/create-position-bundle`, {
    schema: {
      tags: [folderName],
      description: 'Create a new Orca position bundle',
      response: {
        200: Type.Object({
          signature: Type.String(),
          positionBundleMint: Type.String(),
          positionBundleAddress: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      fastify.log.info('Creating new Orca position bundle');
      const result = await controller.createPositionBundle();
      return result;
    }
  });
}
