import { SolanaController } from '../solana/solana.controller';
import { Raydium, Cluster } from '@raydium-io/raydium-sdk-v2';

export class RaydiumController extends SolanaController {
  protected cluster: Cluster;
  protected raydium: Raydium | undefined;

  constructor() {
    super();
    if (!this.keypair) {
      throw new Error('Keypair not loaded. SOLANA_PRIVATE_KEY may not be set.');
    }  
    this.cluster = this.network === 'mainnet-beta' ? 'mainnet' : this.network as Cluster;    
    this.initializeClient();
  }

  protected async initializeClient(): Promise<void> {
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