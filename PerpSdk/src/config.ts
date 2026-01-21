/**
 * Configuration file containing contract addresses and API endpoints
 * for Avantis trading platform
 */

export interface ContractAddresses {
  TradingStorage: string;
  PairStorage: string;
  PairInfos: string;
  PriceAggregator: string;
  USDC: string;
  Trading: string;
  Multicall: string;
  Referral: string;
}

/**
 * Mainnet contract addresses for Avantis (Base Network)
 */
export const CONTRACTS: ContractAddresses = {
  TradingStorage: '0x8a311D7048c35985aa31C131B9A13e03a5f7422d',
  PairStorage: '0x5db3772136e5557EFE028Db05EE95C84D76faEC4',
  PairInfos: '0x81F22d0Cc22977c91bEfE648C9fddf1f2bd977e5',
  PriceAggregator: '0x64e2625621970F8cfA17B294670d61CB883dA511',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  Trading: '0x44914408af82bC9983bbb330e3578E1105e11d4e',
  Multicall: '0xb7125506Ff25211c4C51DFD8DdED00BE6Fa8Cbf7',
  Referral: '0x1A110bBA13A1f16cCa4b79758BD39290f29De82D',
};

/**
 * API endpoints for Avantis services
 */
export const API_ENDPOINTS = {
  SOCKET_API: 'https://socket-api-pub.avantisfi.com/socket-api/v1/data',
  PYTH_WS: 'wss://hermes.pyth.network/ws',
  PYTH_HTTP: 'https://hermes.pyth.network/v2/updates/price/latest',
};

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  contracts: ContractAddresses;
}

/**
 * Get contract address by name
 */
export function getContractAddress(contractName: keyof ContractAddresses): string {
  return CONTRACTS[contractName];
}

/**
 * Update contract addresses (useful for testing or different networks)
 */
export function setContractAddresses(addresses: Partial<ContractAddresses>): void {
  Object.assign(CONTRACTS, addresses);
}
