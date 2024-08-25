import { SolanaController } from '../solana/solana.controller';
import { Raydium, Cluster } from '@raydium-io/raydium-sdk-v2';

export class RaydiumController extends SolanaController {
  protected cluster: Cluster;
  protected raydium: Raydium | undefined;

  constructor() {
    super();
    this.cluster = this.network === 'mainnet-beta' ? 'mainnet' : this.network as Cluster;    
    this.loadRaydium();
  }

  protected async loadRaydium(): Promise<void> {
    try {
      if (!this.raydium) {
        this.raydium = await Raydium.load({
          owner: this.keypair,
          connection: this.connection,
          cluster: this.cluster,
          disableFeatureCheck: true,
          disableLoadToken: true,
          blockhashCommitment: 'finalized',
        });
      }
      console.log("Raydium initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Raydium:", error);
      throw error;
    }
  }

}