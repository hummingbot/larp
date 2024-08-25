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
    const wallet = new Wallet(this.keypair);
    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: "processed",
    });

    this.ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    this.loadOrca();
  }

  protected async loadOrca(): Promise<void> {
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