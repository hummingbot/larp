import { FastifyRequest, FastifyReply } from 'fastify';
import { Connection, Keypair, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { Raydium, TxVersion, parseTokenAccountResp, Cluster } from '@raydium-io/raydium-sdk-v2';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { validateSolanaNetwork } from '../../utils/solana.validators';

export class RaydiumController {
  private connection: Connection;
  private cluster: Cluster;
  private owner: Keypair;
  private raydium: Raydium | undefined;

  constructor() {
    const network = validateSolanaNetwork(process.env.SOLANA_NETWORK);
    this.cluster = network === 'mainnet-beta' ? 'mainnet' : network;
    
    if (!process.env.SOLANA_PRIVATE_KEY) {
      throw new Error('SOLANA_PRIVATE_KEY environment variable is not set');
    }
    
    this.owner = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
    this.connection = new Connection(clusterApiUrl(network));
  
    // Initialize Raydium
    this.initializeRaydium();  
  }

  private async initializeRaydium(): Promise<void> {
    try {
      this.raydium = await Raydium.load({
        owner: this.owner,
        connection: this.connection,
        cluster: this.cluster,
        disableFeatureCheck: true,
        disableLoadToken: true,
        blockhashCommitment: 'finalized',
      });
      console.log("Raydium initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Raydium:", error);
      throw error;
    }
  }

  public async fetchPool(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.raydium) {
        console.log("Raydium not initialized, attempting to initialize...");
        await this.initializeRaydium();
        if (!this.raydium) {
          throw new Error("Failed to initialize Raydium");
        }
      }
  
      const { poolAddress } = request.params as { poolAddress: string };
      console.log("Fetching pool info for address:", poolAddress);
  
      const res = await this.raydium.liquidity.getRpcPoolInfos([poolAddress]);
      // console.log("Raw response:", JSON.stringify(res, null, 2));
  
      const poolInfo = res[poolAddress];
  
      if (!poolInfo) {
        console.log("Pool not found for address:", poolAddress);
        reply.status(404).send({ error: "Pool not found" });
        return;
      }
  
      const formattedPoolInfo = {
        poolPrice: poolInfo.poolPrice ? poolInfo.poolPrice.toString() : null,
      };
      console.log("Formatted pool info:", formattedPoolInfo);

      // Log the raw reply object
      // console.log("Raw reply object before sending:", reply.raw);

      // Log the reply object itself
      // console.log("Reply object before sending:", reply);

      // Set Content-Type header explicitly
      reply.header('Content-Type', 'application/json');


      reply.send({ poolInfo: formattedPoolInfo });

      // Log after sending the reply
      console.log("Reply sent with pool info:", formattedPoolInfo);

    } catch (error) {
      console.error("Error fetching pool info:", error);
      reply.status(500).send({ error: "An error occurred while fetching pool info" });
    }
  }

  // Add more methods here as needed, for example:
  // public async swapTokens(request: FastifyRequest, reply: FastifyReply): Promise<void> { ... }
  // public async addLiquidity(request: FastifyRequest, reply: FastifyReply): Promise<void> { ... }
  // public async removeLiquidity(request: FastifyRequest, reply: FastifyReply): Promise<void> { ... }
}