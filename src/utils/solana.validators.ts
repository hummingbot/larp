export type SolanaNetworkType = 'mainnet-beta' | 'devnet';

export function validateSolanaNetwork(network: string | undefined): SolanaNetworkType {
  if (!network || (network !== 'mainnet-beta' && network !== 'devnet')) {
    throw new Error('Invalid SOLANA_NETWORK. Must be either "mainnet-beta" or "devnet"');
  }
  return network;
}