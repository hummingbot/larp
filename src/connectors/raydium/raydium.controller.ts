import { FastifyRequest, FastifyReply } from 'fastify';
import { Raydium, TxVersion, parseTokenAccountResp, Cluster } from '@raydium-io/raydium-sdk-v2';
import { SolanaController } from '../solana/solana.controller';

export class RaydiumController extends SolanaController {
  private cluster: Cluster;
  private raydium: Raydium | undefined;

  constructor() {
    super();
    this.cluster = this.network === 'mainnet-beta' ? 'mainnet' : this.network as Cluster;    
    this.initializeClient();  
  }

  private async initializeClient(): Promise<void> {
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

  public async fetchPool(request: FastifyRequest, reply: FastifyReply) {
    try {
      await this.initializeClient();
  
      const { poolAddress } = request.params as { poolAddress: string };
      console.log("Fetching Raydium pool for address:", poolAddress);
  
      const res = await this.raydium.liquidity.getRpcPoolInfos([poolAddress]);
      const poolInfo = res[poolAddress];
      console.log("Pool info:", poolInfo);
  
      if (!poolInfo) {
        console.log("Pool not found for address:", poolAddress);
        reply.status(404).send({ error: "Pool not found" });
        return;
      }

      const poolInfoResponse = {
        poolPrice: poolInfo.poolPrice,
        baseTokenAddress: poolInfo.baseMint.toString(),
        quoteTokenAddress: poolInfo.quoteMint.toString(),
      }
  
      reply.send(poolInfoResponse);

    } catch (error) {
      console.error("Error fetching pool info:", error);
      reply.status(500).send({ error: "An error occurred while fetching pool info" });
    }
  }

}