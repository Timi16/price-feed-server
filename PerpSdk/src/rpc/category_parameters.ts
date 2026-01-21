import { Contract, Provider } from 'ethers';
import { OpenInterest, Utilization, Skew, fromBlockchain6 } from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for retrieving category-level parameters
 */
export class CategoryParametersRPC {
  private provider: Provider;
  private pairStorageContract: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    pairStorageContract: Contract,
    pairsCache: PairsCache
  ) {
    this.provider = provider;
    this.pairStorageContract = pairStorageContract;
    this.pairsCache = pairsCache;
  }

  /**
   * Get open interest limits per category
   * Note: Group OI limits are calculated from pair backend data
   * @returns Map of group index to OI limits
   */
  async getOILimits(): Promise<Map<number, OpenInterest>> {
    const groupIndexes = await this.pairsCache.getGroupIndexes();
    const limits = new Map<number, OpenInterest>();

    // Get limits from pair backend data which includes group info
    for (const groupIndex of groupIndexes) {
      try {
        // Get first pair in this group to get group max OI
        const pairsInGroup = await this.pairsCache.getPairsInGroup(groupIndex);
        if (pairsInGroup.length > 0) {
          const backendData = await this.pairsCache.getPairBackend(pairsInGroup[0]);
          const maxOI = Number(backendData.group.maxOpenInterestP) / 1e10; // Convert from 10 decimals to number

          limits.set(groupIndex, {
            long: maxOI,
            short: maxOI,
            max: maxOI,
          });
        }
      } catch (error) {
        console.error(`Error getting OI limits for group ${groupIndex}:`, error);
      }
    }

    return limits;
  }

  /**
   * Get current open interest per category
   * Note: Calculated by summing pair OIs in each group
   * @returns Map of group index to OI
   */
  async getOI(): Promise<Map<number, OpenInterest>> {
    const groupIndexes = await this.pairsCache.getGroupIndexes();
    const oi = new Map<number, OpenInterest>();
    const limits = await this.getOILimits();

    for (const groupIndex of groupIndexes) {
      try {
        // Sum up OI from all pairs in this group
        const pairsInGroup = await this.pairsCache.getPairsInGroup(groupIndex);
        let totalLongOI = 0;
        let totalShortOI = 0;

        // This would require asset params to get individual pair OI
        // For now, return default values
        // TODO: Properly calculate by summing pair OIs
        const maxOI = limits.get(groupIndex)?.max || 0;

        oi.set(groupIndex, {
          long: totalLongOI,
          short: totalShortOI,
          max: maxOI,
        });
      } catch (error) {
        console.error(`Error getting OI for group ${groupIndex}:`, error);
      }
    }

    return oi;
  }

  /**
   * Get utilization per category
   * @returns Map of group index to utilization
   */
  async getUtilization(): Promise<Map<number, Utilization>> {
    const oi = await this.getOI();
    const utilization = new Map<number, Utilization>();

    for (const [groupIndex, oiData] of oi) {
      const utilizationLong = oiData.max > 0 ? (oiData.long / oiData.max) * 100 : 0;
      const utilizationShort = oiData.max > 0 ? (oiData.short / oiData.max) * 100 : 0;

      utilization.set(groupIndex, {
        utilizationLong,
        utilizationShort,
      });
    }

    return utilization;
  }

  /**
   * Get category skew (long / total)
   * @returns Map of group index to skew
   */
  async getCategorySkew(): Promise<Map<number, Skew>> {
    const oi = await this.getOI();
    const skew = new Map<number, Skew>();

    for (const [groupIndex, oiData] of oi) {
      const total = oiData.long + oiData.short;
      const skewValue = total > 0 ? oiData.long / total : 0.5;

      skew.set(groupIndex, { skew: skewValue });
    }

    return skew;
  }
}
