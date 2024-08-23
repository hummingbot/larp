import { Connection, Keypair, clusterApiUrl, Cluster } from '@solana/web3.js';
import bs58 from 'bs58';

export class SolanaController {
  protected network: string;
  protected connection: Connection;
  protected keypair: Keypair;

  constructor() {
    if (!process.env.SOLANA_PRIVATE_KEY) {
        throw new Error('SOLANA_PRIVATE_KEY environment variable is not set');
    }  
    this.network = validateSolanaNetwork(process.env.SOLANA_NETWORK);
    this.connection = new Connection(clusterApiUrl(this.network as Cluster));    
    this.keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
  }
}

export type SolanaNetworkType = 'mainnet-beta' | 'devnet';

export function validateSolanaNetwork(network: string | undefined): SolanaNetworkType {
  if (!network || (network !== 'mainnet-beta' && network !== 'devnet')) {
    throw new Error('Invalid SOLANA_NETWORK. Must be either "mainnet-beta" or "devnet"');
  }
  return network;
}