import { FastifyRequest, FastifyReply } from 'fastify';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { Raydium, TxVersion, parseTokenAccountResp, Cluster } from '@raydium-io/raydium-sdk-v2'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'
import { validateSolanaNetwork } from '../../utils/solana.validators';

const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'mainnet' as Cluster // 'mainnet' | 'devnet'

export class RaydiumController {
  private connection: Connection;
  private cluster: Cluster;
  private owner: Keypair;
  private raydium: Raydium | undefined;

  constructor() {
    const network = validateSolanaNetwork(process.env.SOLANA_NETWORK);
    this.cluster = network === 'mainnet-beta' ? 'mainnet' : network;
    this.owner = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY!));
    this.connection = new Connection(clusterApiUrl(network));
  
    // Initialize Raydium
    this.initializeRaydium();  
  }

  private async initializeRaydium(): Promise<void> {
    this.raydium = await Raydium.load({
      owner: this.owner,
      connection: this.connection,
      cluster: this.cluster,
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: 'finalized',
    });
  }

  public async getPositions(request?: FastifyRequest, reply?: FastifyReply): Promise<void> {
    try {
      // Fetch token accounts
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        this.keypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      // ... rest of the method
    } catch (error) {
      // ... error handling
    }
  }
}