import { Contract } from 'ethers';
import { Trade, fromBlockchain6, fromBlockchain10, fromBlockchain12, toBlockchain6, toBlockchain10 } from '../types';

/**
 * PairInfo Queries RPC
 * Handles querying pair-related information like price impact, skew, fees, and loss protection
 */
export class PairInfoQueriesRPC {
  constructor(
    private pairInfosContract: Contract,
    private priceAggregatorContract: Contract
  ) {}

  /**
   * Get loss protection tier for a trade
   * @param trade - Trade information
   * @param isPnl - Whether calculating for PnL
   * @returns Loss protection tier
   */
  async getLossProtectionTier(trade: Trade, isPnl: boolean = false): Promise<number> {
    // Convert trade to blockchain format
    const tradeStruct = {
      trader: trade.trader,
      pairIndex: trade.pairIndex,
      index: trade.index,
      initialPosToken: toBlockchain6(trade.initialPosToken),
      positionSizeUSDC: toBlockchain6(trade.positionSizeUSDC),
      openPrice: toBlockchain10(trade.openPrice),
      buy: trade.buy,
      leverage: toBlockchain10(trade.leverage),
      tp: toBlockchain10(trade.tp),
      sl: toBlockchain10(trade.sl),
      timestamp: trade.timestamp,
    };

    const tier = await this.pairInfosContract.lossProtectionTier(tradeStruct, isPnl);
    return Number(tier);
  }

  /**
   * Get price impact spread for a position
   * @param pairIndex - Trading pair index
   * @param isLong - True for long position
   * @param positionSizeUsdc - Position size in USDC
   * @param isOpen - Whether opening or closing
   * @returns Price impact spread percentage
   */
  async getPriceImpactSpread(
    pairIndex: number,
    isLong: boolean,
    positionSizeUsdc: number,
    isOpen: boolean
  ): Promise<number> {
    const positionSize = toBlockchain6(positionSizeUsdc);
    const spread = await this.pairInfosContract.getPriceImpactSpread(
      pairIndex,
      isLong,
      positionSize,
      isOpen
    );
    return fromBlockchain10(spread);
  }

  /**
   * Get skew impact spread for a position
   * @param pairIndex - Trading pair index
   * @param isLong - True for long position
   * @param positionSizeUsdc - Position size in USDC
   * @param isOpen - Whether opening or closing
   * @returns Skew impact spread percentage
   */
  async getSkewImpactSpread(
    pairIndex: number,
    isLong: boolean,
    positionSizeUsdc: number,
    isOpen: boolean
  ): Promise<number> {
    const positionSize = toBlockchain6(positionSizeUsdc);
    const spread = await this.pairInfosContract.getSkewImpactSpread(
      pairIndex,
      isLong,
      positionSize,
      isOpen
    );
    return fromBlockchain10(spread);
  }

  /**
   * Get price impact percentage for a position
   * @param pairIndex - Trading pair index
   * @param isLong - True for long position
   * @param positionSizeUsdc - Position size in USDC
   * @returns Price impact percentage
   */
  async getPriceImpactP(
    pairIndex: number,
    isLong: boolean,
    positionSizeUsdc: number
  ): Promise<number> {
    const positionSize = toBlockchain6(positionSizeUsdc);
    const impact = await this.pairInfosContract.getPriceImpactP(pairIndex, isLong, positionSize);
    return fromBlockchain10(impact);
  }

  /**
   * Get opening fee in USDC for a position
   * @param pairIndex - Trading pair index
   * @param positionSizeUsdc - Position size in USDC
   * @param isLong - True for long position
   * @returns Opening fee in USDC
   */
  async getOpenFeeUsdc(
    pairIndex: number,
    positionSizeUsdc: number,
    isLong: boolean
  ): Promise<number> {
    const positionSize = toBlockchain6(positionSizeUsdc);
    const fee = await this.pairInfosContract.getOpenFeeUsdc(pairIndex, positionSize, isLong);
    return fromBlockchain6(fee);
  }

  /**
   * Get opening fee percentage for a position (from PriceAggregator)
   * @param pairIndex - Trading pair index
   * @param positionSizeUsdc - Position size in USDC
   * @param isLong - True for long position
   * @returns Opening fee percentage (12 decimals)
   */
  async getOpenFeeP(
    pairIndex: number,
    positionSizeUsdc: number,
    isLong: boolean
  ): Promise<number> {
    const positionSize = toBlockchain6(positionSizeUsdc);
    const fee = await this.priceAggregatorContract.openFeeP(pairIndex, positionSize, isLong);
    return fromBlockchain12(fee);
  }

  /**
   * Get pair margin fee percentage
   * @param pairIndex - Trading pair index
   * @returns Margin fee percentage
   */
  async getPairMarginFeeP(pairIndex: number): Promise<number> {
    const fee = await this.pairInfosContract.getPairMarginFeeP(pairIndex);
    return fromBlockchain10(fee);
  }

  /**
   * Get loss protection tier for a pair and position size
   * @param pairIndex - Trading pair index
   * @param positionSizeUsdc - Position size in USDC
   * @returns Loss protection tier
   */
  async getLossProtectionTierForSize(
    pairIndex: number,
    positionSizeUsdc: number
  ): Promise<number> {
    const positionSize = toBlockchain6(positionSizeUsdc);
    const tier = await this.pairInfosContract.getLossProtectionTier(pairIndex, positionSize);
    return Number(tier);
  }

  /**
   * Get loss protection percentage for a pair and tier
   * @param pairIndex - Trading pair index
   * @param tier - Loss protection tier
   * @returns Loss protection percentage
   */
  async getLossProtectionP(pairIndex: number, tier: number): Promise<number> {
    const protection = await this.pairInfosContract.getLossProtectionP(pairIndex, tier);
    return fromBlockchain10(protection);
  }

  /**
   * Get 1% depth above (for longs) in USDC
   * @param pairIndex - Trading pair index
   * @returns Depth in USDC
   */
  async getOnePercentDepthAboveUsdc(pairIndex: number): Promise<number> {
    const depth = await this.pairInfosContract.onePercentDepthAboveUsdc(pairIndex);
    return fromBlockchain6(depth);
  }

  /**
   * Get 1% depth below (for shorts) in USDC
   * @param pairIndex - Trading pair index
   * @returns Depth in USDC
   */
  async getOnePercentDepthBelowUsdc(pairIndex: number): Promise<number> {
    const depth = await this.pairInfosContract.onePercentDepthBelowUsdc(pairIndex);
    return fromBlockchain6(depth);
  }

  /**
   * Get both depth values for a pair
   * @param pairIndex - Trading pair index
   * @returns Object with depth above and below
   */
  async getDepth(pairIndex: number): Promise<{ above: number; below: number }> {
    const [above, below] = await Promise.all([
      this.getOnePercentDepthAboveUsdc(pairIndex),
      this.getOnePercentDepthBelowUsdc(pairIndex),
    ]);

    return { above, below };
  }
}
