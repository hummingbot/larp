import { SolanaController } from '../solana/solana.controller';
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolClient
} from "@orca-so/whirlpools-sdk";

export class OrcaController extends SolanaController {
  protected ctx: WhirlpoolContext;
  protected client: WhirlpoolClient;

  constructor() {
    super();
    if (!this.keypair) {
      throw new Error('Keypair not loaded. SOLANA_PRIVATE_KEY may not be set.');
    }
    const wallet = new Wallet(this.keypair);
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: "processed",
    });

    this.ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    this.initializeClient();
  }

  protected async initializeClient(): Promise<void> {
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
}