import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";  
import { BN } from "@coral-xyz/anchor";
import { PDAUtil, IGNORE_CACHE } from "@orca-so/whirlpools-sdk";
import { OrcaController } from '../orca.controller';

class GetPositionsController extends OrcaController {
  async getPositions(address: string): Promise<string[]> {
    await this.initializeClient();

    const publicKey = new PublicKey(address);

    // Get all token accounts
    const tokenAccounts = (await this.ctx.connection.getTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })).value;

    // Get candidate addresses for the position
    const whirlpoolPositionCandidatePubkeys = tokenAccounts.map((ta) => {
      const parsed = unpackAccount(ta.pubkey, ta.account);
      const pda = PDAUtil.getPosition(this.ctx.program.programId, parsed.mint);
      return new BN(parsed.amount.toString()).eq(new BN(1)) ? pda.publicKey : undefined;
    }).filter(pubkey => pubkey !== undefined);

    // Get data from Whirlpool position addresses
    const whirlpoolPositionCandidateDatas = await this.ctx.fetcher.getPositions(whirlpoolPositionCandidatePubkeys, IGNORE_CACHE);
    
    // Leave only addresses with correct data acquisition as position addresses
    const whirlpoolPositions = whirlpoolPositionCandidatePubkeys.filter((pubkey, i) => 
      whirlpoolPositionCandidateDatas[i] !== null
    );

    // Output the address of the positions
    return whirlpoolPositions.map((positionPubkey) => positionPubkey.toBase58());
  }
}

export default function getPositionsRoute(fastify: FastifyInstance, folderName: string) {
  const controller = new GetPositionsController();

  fastify.get(`/${folderName}/positions/:address`, {
    schema: {
      tags: [folderName],
      description: 'Retrieve Orca positions owned by an address',
      params: Type.Object({
        address: Type.String()
      }),
      response: {
        200: Type.Object({
          positions: Type.Array(Type.String())
        })
      }
    },
    handler: async (request, reply) => {
      const { address } = request.params as { address: string };
      fastify.log.info(`Getting Orca positions for address: ${address}`);
      
      const positions = await controller.getPositions(address);
      return { positions };
    }
  });
}