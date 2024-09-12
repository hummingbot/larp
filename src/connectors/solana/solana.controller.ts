import { Connection, Keypair, clusterApiUrl, Cluster } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { PublicKey } from "@solana/web3.js";
import { Type } from '@sinclair/typebox';

// Update the TOKEN_LIST_FILE constant
const TOKEN_LIST_FILE = process.env.SOLANA_NETWORK === 'devnet' 
  ? 'devnet-tokenlist.json' 
  : 'solflare-tokenlist-20240912.json';

export const SolanaAddressSchema = Type.String({
  pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
  description: 'Solana address in base58 format'
});

export const BadRequestResponseSchema = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  message: Type.String()
});

export type SolanaNetworkType = 'mainnet-beta' | 'devnet';

export class SolanaController {
  protected network: string;
  protected connection: Connection;
  protected keypair: Keypair | null = null;
  protected tokenList: any = null;

  constructor() {
    this.network = this.validateSolanaNetwork(process.env.SOLANA_NETWORK);
    this.connection = new Connection(clusterApiUrl(this.network as Cluster));
    this.loadWallet();
    this.loadTokenList();
  }

  public validateSolanaNetwork(network: string | undefined): SolanaNetworkType {
    if (!network || (network !== 'mainnet-beta' && network !== 'devnet')) {
      throw new Error('Invalid SOLANA_NETWORK. Must be either "mainnet-beta" or "devnet"');
    }
    return network;
  }

  public validateSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  protected loadWallet(): void {
    const walletPath = process.env.SOLANA_WALLET_JSON;
    if (!walletPath) {
      throw new Error('SOLANA_WALLET_JSON environment variable is not set');
    }
    try {
      const secretKeyArray = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      this.keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
      console.log(`Wallet loaded successfully. Public key: ${this.keypair.publicKey.toBase58()}`);
    } catch (error) {
      throw new Error(`Failed to load wallet JSON: ${error.message}`);
    }
  }

  protected loadTokenList(): void {
    const tokenListPath = path.join(__dirname, TOKEN_LIST_FILE);
    try {
      this.tokenList = JSON.parse(fs.readFileSync(tokenListPath, 'utf8'));
      console.log(`Token list loaded successfully: ${TOKEN_LIST_FILE}`);
    } catch (error) {
      console.error(`Failed to load token list ${TOKEN_LIST_FILE}: ${error.message}`);
      this.tokenList = { content: [] };
    }
  }

  public getWallet(): { publicKey: string; network: string } {
    return {
      publicKey: this.keypair.publicKey.toBase58(),
      network: this.network,
    };
  }

  public getTokenList(): any {
    return this.tokenList.content || [];
  }
}