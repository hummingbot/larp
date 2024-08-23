import { FastifyRequest, FastifyReply } from 'fastify';
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { Raydium, TxVersion, parseTokenAccountResp, Cluster } from '@raydium-io/raydium-sdk-v2'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'
import { validateSolanaNetwork } from '../../utils/solana.validators';

const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'mainnet' as Cluster // 'mainnet' | 'devnet'
const pool2 = '6UmmUiYoBjSrhakAobJw8BvkmJtDVxaeBtbt7rxWo1mg'

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
    console.log("Raydium initialized");
  }

  public async fetchPool(poolAddress: string, reply: FastifyReply): Promise<void> {
    try {
      if (!this.raydium) {
        throw new Error("Raydium not initialized");
      }

      console.log("Fetching pool info for address:", poolAddress);
      const poolInfos = await this.raydium.liquidity.getRpcPoolInfos([poolAddress]);
      console.log("Received poolInfos:", poolInfos);

      const poolInfo = poolInfos[0];

      if (!poolInfo) {
        console.log("Pool not found for address:", poolAddress);
        reply.status(404).send({ error: "Pool not found" });
        return;
      }

      console.log("Pool info:", poolInfo);
      reply.send({ poolInfo: JSON.parse(JSON.stringify(poolInfo)) });
    } catch (error) {
      console.error("Error fetching pool info:", error);
      reply.status(500).send({ error: "An error occurred while fetching pool info" });
    }
  }
}