import { Contract, Provider } from 'ethers';
import { TradeInput, LossProtectionInfo, fromBlockchain10, toBlockchain6 } from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for trading-related parameters
 */
export class TradingParametersRPC {
  private provider: Provider;
  private pairInfosContract: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    pairInfosContract: Contract,
    pairsCache: PairsCache
  ) {
    this.provider = provider;
    this.pairInfosContract = pairInfosContract;
    this.pairsCache = pairsCache;
  }

  /**
   * Get loss protection tier for a trade
   * @param tradeInput - Trade input parameters
   * @returns Loss protection tier
   */
  async getLossProtectionTier(tradeInput: TradeInput): Promise<number> {
    const pairIndex = await this.pairsCache.getPairIndex(tradeInput.pair);
    if (pairIndex === undefined) {
      throw new Error(`Pair ${tradeInput.pair} not found`);
    }

    try {
      const tier = await this.pairInfosContract.getLossProtectionTier(
        pairIndex,
        toBlockchain6(tradeInput.collateralInTrade)
      );
      return Number(tier);
    } catch (error) {
      console.error('Error getting loss protection tier:', error);
      return 0;
    }
  }

  /**
   * Get loss protection percentage for a tier
   * @param tier - Loss protection tier
   * @param pairIndex - Pair index
   * @returns Loss protection percentage
   */
  async getLossProtectionPercentage(tier: number, pairIndex: number): Promise<number> {
    try {
      const percentage = await this.pairInfosContract.getLossProtectionP(tier, pairIndex);
      return fromBlockchain10(percentage);
    } catch (error) {
      console.error('Error getting loss protection percentage:', error);
      return 0;
    }
  }

  /**
   * Calculate loss protection amount
   * @param tier - Loss protection tier
   * @param pairIndex - Pair index
   * @param collateral - Collateral amount
   * @param openingFee - Opening fee amount
   * @returns Loss protection amount
   */
  async getLossProtectionAmount(
    tier: number,
    pairIndex: number,
    collateral: number,
    openingFee: number
  ): Promise<number> {
    const percentage = await this.getLossProtectionPercentage(tier, pairIndex);
    return openingFee * (percentage / 100);
  }

  /**
   * Get complete loss protection info for a trade
   * @param tradeInput - Trade input parameters
   * @param openingFee - Opening fee amount
   * @returns Loss protection info
   */
  async getLossProtectionInfo(
    tradeInput: TradeInput,
    openingFee: number
  ): Promise<LossProtectionInfo> {
    const pairIndex = await this.pairsCache.getPairIndex(tradeInput.pair);
    if (pairIndex === undefined) {
      throw new Error(`Pair ${tradeInput.pair} not found`);
    }

    const tier = await this.getLossProtectionTier(tradeInput);
    const percentage = await this.getLossProtectionPercentage(tier, pairIndex);
    const amount = await this.getLossProtectionAmount(
      tier,
      pairIndex,
      tradeInput.collateralInTrade,
      openingFee
    );

    return {
      tier,
      percentage,
      amount,
    };
  }

  /**
   * Get referral rebate for a trader
   * @param trader - Trader address
   * @param referrer - Referrer address
   * @param openingFee - Opening fee amount
   * @returns Rebate amount
   */
  async getTradeReferralRebate(
    trader: string,
    referrer: string,
    openingFee: number
  ): Promise<number> {
    // This would typically call the referral contract
    // For now, return 0 as a placeholder
    return 0;
  }
}
