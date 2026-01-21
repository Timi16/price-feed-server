import { Contract, Provider } from 'ethers';
import { Fee, TradeInput, fromBlockchain10, toBlockchain6 } from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for fee calculations
 */
export class FeeParametersRPC {
  private provider: Provider;
  private pairInfosContract: Contract;
  private referralContract?: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    pairInfosContract: Contract,
    pairsCache: PairsCache,
    referralContract?: Contract
  ) {
    this.provider = provider;
    this.pairInfosContract = pairInfosContract;
    this.pairsCache = pairsCache;
    this.referralContract = referralContract;
  }

  /**
   * Get margin fee for all pairs (in basis points)
   * @returns Map of pair index to fee
   */
  async getMarginFee(): Promise<Map<number, Fee>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const fees = new Map<number, Fee>();

    for (const [pairIndex] of pairs) {
      try {
        const feeP = await this.pairInfosContract.getPairMarginFeeP(pairIndex);
        fees.set(pairIndex, {
          feeP: fromBlockchain10(feeP),
        });
      } catch (error) {
        console.error(`Error getting margin fee for pair ${pairIndex}:`, error);
        fees.set(pairIndex, { feeP: 0 });
      }
    }

    return fees;
  }

  /**
   * Get constant spread parameter for each pair
   * @returns Map of pair index to constant spread
   */
  async constantSpreadParameter(): Promise<Map<number, number>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const spreads = new Map<number, number>();

    for (const [pairIndex, pairInfo] of pairs) {
      // Use the min spread as the constant spread
      spreads.set(pairIndex, pairInfo.spread.min);
    }

    return spreads;
  }

  /**
   * Get opening fee for a position
   * @param positionSize - Position size in USDC
   * @param isLong - True for long, false for short
   * @param pairIndex - Pair index
   * @returns Opening fee in USDC
   */
  async getOpeningFee(
    positionSize: number,
    isLong: boolean,
    pairIndex: number
  ): Promise<number> {
    try {
      const feeUsdc = await this.pairInfosContract.getOpenFeeUsdc(
        pairIndex,
        toBlockchain6(positionSize),
        isLong
      );
      return fromBlockchain10(feeUsdc);
    } catch (error) {
      console.error('Error getting opening fee:', error);
      return 0;
    }
  }

  /**
   * Get opening fee for a new trade with referral
   * @param tradeInput - Trade input parameters
   * @param referrer - Referrer address (optional)
   * @returns Opening fee in USDC
   */
  async getNewTradeOpeningFee(
    tradeInput: TradeInput,
    referrer?: string
  ): Promise<number> {
    const pairIndex = await this.pairsCache.getPairIndex(tradeInput.pair);
    if (pairIndex === undefined) {
      throw new Error(`Pair ${tradeInput.pair} not found`);
    }

    const positionSize = tradeInput.collateralInTrade * tradeInput.leverage;
    let fee = await this.getOpeningFee(positionSize, tradeInput.isLong, pairIndex);

    // Apply referral discount if applicable
    if (referrer && this.referralContract) {
      try {
        const rebate = await this.getTradeReferralRebate(
          tradeInput.referrer || referrer,
          referrer,
          fee
        );
        fee -= rebate;
      } catch (error) {
        console.error('Error getting referral rebate:', error);
      }
    }

    return fee;
  }

  /**
   * Get trade referral rebate
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
    if (!this.referralContract) {
      return 0;
    }

    try {
      const rebateP = await this.referralContract.getReferralRebateP(trader, referrer);
      const rebatePercentage = fromBlockchain10(rebateP);
      return openingFee * (rebatePercentage / 100);
    } catch (error) {
      console.error('Error getting referral rebate:', error);
      return 0;
    }
  }
}
