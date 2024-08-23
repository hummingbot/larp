import { FastifyRequest, FastifyReply } from 'fastify';
import { PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil, IGNORE_CACHE, WhirlpoolClient
} from "@orca-so/whirlpools-sdk";
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";
import { SolanaController } from '../solana/solana.controller';

export class OrcaController extends SolanaController {
  private ctx: WhirlpoolContext;
  private client: WhirlpoolClient;

  constructor() {
    super();
    const wallet = new Wallet(this.keypair);
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: "processed",
    });

    this.ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      if (!this.client) {
        this.client = await buildWhirlpoolClient(this.ctx);
      }
      console.log("Orca initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Orca:", error);
      throw error;
    }
  }

  public async getPositions(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.initializeClient();

      const { address } = request.params as { address: string };
      const publicKey = new PublicKey(address);
      console.log("Fetching Orca positions owned by address:", address);

      // Get all token accounts
      const tokenAccounts = (await this.ctx.connection.getTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })).value;

      // Get candidate addresses for the position
      const whirlpoolPositionCandidatePubkeys = tokenAccounts.map((ta) => {
        const parsed = unpackAccount(ta.pubkey, ta.account);
        // Derive the address of Whirlpool's position from the mint address (whether or not it exists)
        const pda = PDAUtil.getPosition(this.ctx.program.programId, parsed.mint);
        // Returns the address of the Whirlpool position only if the number of tokens is 1 (ignores empty token accounts and non-NFTs)
        return new BN(parsed.amount.toString()).eq(new BN(1)) ? pda.publicKey : undefined;
      }).filter(pubkey => pubkey !== undefined);

      // Get data from Whirlpool position addresses
      const whirlpoolPositionCandidateDatas = await this.ctx.fetcher.getPositions(whirlpoolPositionCandidatePubkeys, IGNORE_CACHE);
      // Leave only addresses with correct data acquisition as position addresses
      const whirlpoolPositions = whirlpoolPositionCandidatePubkeys.filter((pubkey, i) => 
        whirlpoolPositionCandidateDatas[i] !== null
      );

      // Output the address of the positions
      const positions = whirlpoolPositions.map((positionPubkey) => positionPubkey.toBase58());

      console.log("Positions:", positions);
      reply.send({ positions });
    } catch (error) {
      console.error("Error fetching positions:", error);
      reply.status(500).send("An error occurred while fetching positions.");
    }
  }
}