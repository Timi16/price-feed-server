import { ethers, JsonRpcProvider, Contract, TransactionReceipt, TransactionRequest } from 'ethers';
import { BaseSigner } from './signers/base';
import { LocalSigner } from './signers/local';
import { KMSSigner } from './signers/kms';
import { FeedClient } from './feed/feed_client';
import { CONTRACTS, getContractAddress } from './config';
import { PairsCache } from './rpc/pairs_cache';
import { AssetParametersRPC } from './rpc/asset_parameters';
import { CategoryParametersRPC } from './rpc/category_parameters';
import { FeeParametersRPC } from './rpc/fee_parameters';
import { TradingParametersRPC } from './rpc/trading_parameters';
import { BlendedRPC } from './rpc/blended';
import { TradeRPC } from './rpc/trade';
import { SnapshotRPC } from './rpc/snapshot';
import { TradingOperationsRPC } from './rpc/trading_operations';
import { DelegationRPC } from './rpc/delegation';
import { PairInfoQueriesRPC } from './rpc/pair_info_queries';
import { ReferralOperationsRPC } from './rpc/referral_operations';
import { MulticallRPC } from './rpc/multicall';
import { fromBlockchain6 } from './types';
import {
  ERC20_ABI,
  TRADING_ABI,
  TRADING_STORAGE_ABI,
  PAIR_STORAGE_ABI,
  PAIR_INFOS_ABI,
  PRICE_AGGREGATOR_ABI,
  REFERRAL_ABI,
  MULTICALL_ABI,
} from './abis';

/**
 * Main client for interacting with Avantis trading platform
 */
export class TraderClient {
  public provider: JsonRpcProvider;
 signer?: BaseSigner;
  public feedClient?: FeedClient;


  // Contracts
  private contracts: Map<string, Contract> = new Map();

  // RPC modules
  public pairsCache: PairsCache;
  public assetParams: AssetParametersRPC;
  public categoryParams: CategoryParametersRPC;
  public feeParams: FeeParametersRPC;
  public tradingParams: TradingParametersRPC;
  public blendedParams: BlendedRPC;
  public tradeRPC: TradeRPC;
  public snapshotRPC: SnapshotRPC;

  // New trading modules
  public tradingOps: TradingOperationsRPC;
  public delegation: DelegationRPC;
  public pairInfoQueries: PairInfoQueriesRPC;
  public referral: ReferralOperationsRPC;
  public multicall: MulticallRPC;

  /**
   * Create a new TraderClient
   * @param providerUrl - Ethereum RPC endpoint
   * @param signer - Transaction signer (optional)
   * @param feedClient - Feed client for price updates (optional)
   */
  constructor(
    providerUrl: string,
    signer?: BaseSigner,
    feedClient?: FeedClient
  ) {
    this.provider = new JsonRpcProvider(providerUrl);
    this.signer = signer;
    this.feedClient = feedClient;


    // Initialize RPC modules
    this.initializeContracts();
    this.pairsCache = new PairsCache(
      this.provider,
      this.getContract('PairStorage')
    );

    const pairStorage = this.getContract('PairStorage');
    const pairInfos = this.getContract('PairInfos');
    const trading = this.getContract('Trading');
    const tradingStorage = this.getContract('TradingStorage');
    const referral = this.getContract('Referral');

    this.assetParams = new AssetParametersRPC(
      this.provider,
      pairStorage,
      pairInfos,
      this.pairsCache,
      tradingStorage
    );

    this.categoryParams = new CategoryParametersRPC(
      this.provider,
      pairStorage,
      this.pairsCache
    );

    this.feeParams = new FeeParametersRPC(
      this.provider,
      pairInfos,
      this.pairsCache,
      referral
    );

    this.tradingParams = new TradingParametersRPC(
      this.provider,
      pairInfos,
      this.pairsCache
    );

    this.blendedParams = new BlendedRPC(
      this.assetParams,
      this.categoryParams,
      this.pairsCache
    );

    this.tradeRPC = new TradeRPC(
      this.provider,
      trading,
      tradingStorage,
      this.pairsCache
    );

    this.snapshotRPC = new SnapshotRPC(
      this.pairsCache,
      this.assetParams,
      this.categoryParams,
      this.feeParams,
      this.blendedParams
    );

    // Initialize new trading modules
    this.tradingOps = new TradingOperationsRPC(
      trading,
      tradingStorage,
      this.signer
    );

    this.delegation = new DelegationRPC(
      trading,
      this.signer
    );

    this.pairInfoQueries = new PairInfoQueriesRPC(
      pairInfos,
      this.getContract('PriceAggregator')
    );

    this.referral = new ReferralOperationsRPC(
      referral,
      this.signer
    );

    this.multicall = new MulticallRPC(
      this.getContract('Multicall')
    );
  }

  /**
   * Initialize contract instances
   */
  private initializeContracts(): void {
    this.contracts.set(
      'TradingStorage',
      new Contract(CONTRACTS.TradingStorage, TRADING_STORAGE_ABI, this.provider)
    );
    this.contracts.set(
      'PairStorage',
      new Contract(CONTRACTS.PairStorage, PAIR_STORAGE_ABI, this.provider)
    );
    this.contracts.set(
      'PairInfos',
      new Contract(CONTRACTS.PairInfos, PAIR_INFOS_ABI, this.provider)
    );
    this.contracts.set(
      'PriceAggregator',
      new Contract(CONTRACTS.PriceAggregator, PRICE_AGGREGATOR_ABI, this.provider)
    );
    this.contracts.set(
      'USDC',
      new Contract(CONTRACTS.USDC, ERC20_ABI, this.provider)
    );
    this.contracts.set(
      'Trading',
      new Contract(CONTRACTS.Trading, TRADING_ABI, this.provider)
    );
    this.contracts.set(
      'Referral',
      new Contract(CONTRACTS.Referral, REFERRAL_ABI, this.provider)
    );
    this.contracts.set(
      'Multicall',
      new Contract(CONTRACTS.Multicall, MULTICALL_ABI, this.provider)
    );
  }

  /**
   * Get a contract instance
   * @param name - Contract name
   * @returns Contract instance
   */
  private getContract(name: string): Contract {
    const contract = this.contracts.get(name);
    if (!contract) {
      throw new Error(`Contract ${name} not initialized`);
    }
    return contract;
  }

  /**
   * Set signer for transaction signing
   * @param signer - Signer instance
   */
  setSigner(signer: BaseSigner): void {
    this.signer = signer;
    this.tradingOps.setSigner(signer);
    this.delegation.setSigner(signer);
    this.referral.setSigner(signer);
  }

  /**
   * Set local signer using private key
   * @param privateKey - Private key
   */
  setLocalSigner(privateKey: string): void {
    this.signer = new LocalSigner(privateKey, this.provider);
    this.setSigner(this.signer);
  }

  /**
   * Set AWS KMS signer
   * @param kmsKeyId - KMS key ID
   * @param region - AWS region
   */
  setAwsKmsSigner(kmsKeyId: string, region: string = 'us-east-1'): void {
    this.signer = new KMSSigner(kmsKeyId, this.provider, region);
    this.setSigner(this.signer);
  }

  /**
   * Get native token balance
   * @param address - Address to check
   * @returns Balance in native token
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  /**
   * Get USDC balance
   * @param address - Address to check
   * @returns USDC balance
   */
  async getUsdcBalance(address: string): Promise<number> {
    const balance = await this.getContract('USDC').balanceOf(address);
    return fromBlockchain6(balance);
  }

  /**
   * Get USDC allowance for trading
   * @param address - Address to check
   * @returns Allowance amount
   */
  async getUsdcAllowanceForTrading(address: string): Promise<number> {
    const tradingStorageAddress = await this.getContract('TradingStorage').getAddress();
    const allowance = await this.getContract('USDC').allowance(address, tradingStorageAddress);
    return fromBlockchain6(allowance);
  }

  /**
   * Approve USDC for trading
   * @param amount - Amount to approve
   * @returns Transaction receipt
   */
  async approveUsdcForTrading(amount: number): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    const tradingStorageAddress = await this.getContract('TradingStorage').getAddress();
    const amountWei = BigInt(Math.floor(amount * 1e6));

    const tx: TransactionRequest = {
      to: CONTRACTS.USDC,
      data: this.getContract('USDC').interface.encodeFunctionData('approve', [
        tradingStorageAddress,
        amountWei,
      ]),
    };

    return await this.signAndGetReceipt(tx);
  }

  /**
   * Sign transaction and wait for receipt
   * @param tx - Transaction to sign
   * @returns Transaction receipt
   */
  async signAndGetReceipt(tx: TransactionRequest, simulate =false): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    await this.validateTransactionRequest(tx);


    // Sign the transaction
    const signedTx = await this.signer.signTransaction(tx);

    // Send the transaction
    const txResponse = await this.provider.broadcastTransaction(signedTx);

    // Wait for confirmation
    return await txResponse.wait();
  }

async validateTransactionRequest(tx: TransactionRequest): Promise<void> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    // Fill in missing transaction fields
    const address = await this.signer.getAddress();
    tx.from = address;

    if (!tx.chainId) {
      const network = await this.provider.getNetwork();
      tx.chainId = network.chainId;
    }

    if (tx.nonce === undefined) {
      tx.nonce = await this.provider.getTransactionCount(address);
    }

    if (!tx.gasLimit) {
      tx.gasLimit = await this.provider.estimateGas(tx);
    }

    if (!tx.maxFeePerGas && !tx.gasPrice) {
      const feeData = await this.provider.getFeeData();
      if (feeData.maxFeePerGas) {
        tx.maxFeePerGas = feeData.maxFeePerGas;
        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas;
      } else {
        tx.gasPrice = feeData.gasPrice || undefined;
      }
    }
  }

  async simulateTransaction(tx: TransactionRequest): Promise<bigint> {
    await this.validateTransactionRequest(tx);

    try {
     return await this.provider.estimateGas(tx);
    } catch (error: any) {
      console.error('Transaction simulation failed:', error);
      throw new Error(`Transaction simulation failed: ${error.message}`);
    }
  }
  /**
   * Estimate gas for a transaction
   * @param tx - Transaction to estimate
   * @returns Estimated gas
   */
  async estimateGas(tx: TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(tx);
  }

  /**
   * Get transaction count (nonce)
   * @param address - Address to check
   * @returns Transaction count
   */
  async getTransactionCount(address: string): Promise<number> {
    return await this.provider.getTransactionCount(address);
  }

  /**
   * Get chain ID
   * @returns Chain ID
   */
  async getChainId(): Promise<bigint> {
    const network = await this.provider.getNetwork();
    return network.chainId;
  }
}
