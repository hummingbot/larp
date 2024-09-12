import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from "@solana/web3.js";
import {
  PDAUtil, IGNORE_CACHE, PositionBundleUtil, WhirlpoolIx
} from "@orca-so/whirlpools-sdk";
import { TransactionBuilder } from "@orca-so/common-sdk";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OrcaController } from '../orca.controller';

class DeletePositionBundleController extends OrcaController {
  async deletePositionBundle(positionBundleAddress: string): Promise<{ signature: string }> {
    await this.loadOrca();

    const position_bundle_pubkey = new PublicKey(positionBundleAddress);
    console.log("position bundle address:", position_bundle_pubkey.toBase58());

    // Get PositionBundle account
    const position_bundle = await this.ctx.fetcher.getPositionBundle(position_bundle_pubkey, IGNORE_CACHE);

    // If there are open BundledPositions, it cannot be deleted
    if (!PositionBundleUtil.isEmpty(position_bundle)) {
      throw new Error("Position bundle is not empty");
    }

    // Build the instruction to delete PositionBundle
    const position_bundle_token_account = getAssociatedTokenAddressSync(position_bundle.positionBundleMint, this.ctx.wallet.publicKey);
    const delete_position_bundle_ix = WhirlpoolIx.deletePositionBundleIx(
      this.ctx.program,
      {
        positionBundle: position_bundle_pubkey,
        positionBundleMint: position_bundle.positionBundleMint,
        positionBundleTokenAccount: position_bundle_token_account,
        owner: this.ctx.wallet.publicKey,
        receiver: this.ctx.wallet.publicKey,
      }
    )

    // Create a transaction
    const tx_builder = new TransactionBuilder(this.ctx.connection, this.ctx.wallet);
    tx_builder.addInstruction(delete_position_bundle_ix);

    // Send the transaction
    const signature = await tx_builder.buildAndExecute();
    console.log("signature:", signature);

    // Wait for the transaction to complete
    const latest_blockhash = await this.ctx.connection.getLatestBlockhash();
    await this.ctx.connection.confirmTransaction({signature, ...latest_blockhash}, "confirmed");

    return { signature };
  }
}

export default function deletePositionBundleRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new DeletePositionBundleController();

  fastify.post(`/${folderName}/delete-position-bundle`, {
    schema: {
      tags: [folderName],
      description: 'Delete an Orca position bundle',
      querystring: Type.Object({
        positionBundleAddress: Type.String(),
      }),
      response: {
        200: Type.Object({
          signature: Type.String(),
        })
      }
    },
    handler: async (request, reply) => {
      const { positionBundleAddress } = request.query as { positionBundleAddress: string };
      fastify.log.info(`Deleting Orca position bundle: ${positionBundleAddress}`);
      const result = await controller.deletePositionBundle(positionBundleAddress);
      return result;
    }
  });
}
