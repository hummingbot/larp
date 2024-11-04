import { SolanaController } from '../solana/solana.controller';
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolClient
} from "@orca-so/whirlpools-sdk";
import { PublicKey } from "@solana/web3.js";

export class OrcaController extends SolanaController {
  protected ctx: WhirlpoolContext;
  protected client: WhirlpoolClient;
  private static orcaLogged: boolean = false;
  protected WHIRLPOOL_CONFIG_ADDRESS: PublicKey;

  constructor() {
    super();
    const wallet = new Wallet(this.keypair);
    const provider = new AnchorProvider(this.connectionPool.getNextConnection(), wallet, {
      commitment: "processed",
    });

    this.WHIRLPOOL_CONFIG_ADDRESS = this.network === 'devnet'
      ? new PublicKey("FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR")
      : new PublicKey("2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ");

    this.ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
    this.loadOrca();
  }

  protected async loadOrca(): Promise<void> {
    try {
      if (!this.client) {
        this.client = await buildWhirlpoolClient(this.ctx);
      }
      
      // Log only once
      if (!OrcaController.orcaLogged) {
        console.log("Orca connector initialized");
        OrcaController.orcaLogged = true;
      }
    } catch (error) {
      console.error("Failed to initialize Orca:", error);
      throw error;
    }
  }
}
