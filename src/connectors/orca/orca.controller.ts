import { SolanaController } from '../solana/solana.controller';
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolClient
} from "@orca-so/whirlpools-sdk";
import { PublicKey } from "@solana/web3.js";

export class OrcaController extends SolanaController {
  protected ctx: WhirlpoolContext;
  protected client: WhirlpoolClient;
  protected DEVNET_WHIRLPOOLS_CONFIG = new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR");

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
