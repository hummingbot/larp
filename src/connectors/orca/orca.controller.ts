import { FastifyRequest, FastifyReply } from 'fastify';
import { Keypair, Connection, clusterApiUrl } from '@solana/web3.js';
import bs58 from 'bs58';
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil, IGNORE_CACHE
} from "@orca-so/whirlpools-sdk";
import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is not set in the environment variables');
}

export class OrcaController {
  public async getPositions(request?: FastifyRequest, reply?: FastifyReply): Promise<void> {
    try {
      const connection = new Connection(clusterApiUrl("mainnet-beta"));
      const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
      const wallet = new Wallet(keypair);
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "processed",
      });

      const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
      const client = buildWhirlpoolClient(ctx);

      // Get all token accounts
      const tokenAccounts = (await ctx.connection.getTokenAccountsByOwner(ctx.wallet.publicKey, { programId: TOKEN_PROGRAM_ID })).value;

      // Get candidate addresses for the position
      const whirlpoolPositionCandidatePubkeys = tokenAccounts.map((ta) => {
        const parsed = unpackAccount(ta.pubkey, ta.account);

        // Derive the address of Whirlpool's position from the mint address (whether or not it exists)
        const pda = PDAUtil.getPosition(ctx.program.programId, parsed.mint);

        // Returns the address of the Whirlpool position only if the number of tokens is 1 (ignores empty token accounts and non-NFTs)
        return new BN(parsed.amount.toString()).eq(new BN(1)) ? pda.publicKey : undefined;
      }).filter(pubkey => pubkey !== undefined);

      // Get data from Whirlpool position addresses
      const whirlpoolPositionCandidateDatas = await ctx.fetcher.getPositions(whirlpoolPositionCandidatePubkeys, IGNORE_CACHE);
      // Leave only addresses with correct data acquisition as position addresses
      const whirlpoolPositions = whirlpoolPositionCandidatePubkeys.filter((pubkey, i) => 
        whirlpoolPositionCandidateDatas[i] !== null
      );

      // Output the address of the positions
      const positions = whirlpoolPositions.map((positionPubkey) => positionPubkey.toBase58());

      reply.send({ positions, wallet });
    } catch (error) {
      console.error("Error fetching positions:", error);
      reply.status(500).send("An error occurred while fetching positions.");
    }
  }
}
