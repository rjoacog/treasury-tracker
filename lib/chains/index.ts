import { ethereumAdapter, type EthereumAdapter } from './ethereum';

export type SupportedNetwork = 'ethereum-mainnet';

export type ChainAdapter = EthereumAdapter;

export function getChainAdapter(network: SupportedNetwork = 'ethereum-mainnet'): ChainAdapter {
  switch (network) {
    case 'ethereum-mainnet':
    default:
      return ethereumAdapter;
  }
}

