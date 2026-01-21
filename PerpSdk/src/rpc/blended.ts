import { Contract, Provider } from 'ethers';
import { Utilization, Skew } from '../types';
import { AssetParametersRPC } from './asset_parameters';
import { CategoryParametersRPC } from './category_parameters';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for blended calculations (25% asset + 75% category)
 */
export class BlendedRPC {
  private assetParams: AssetParametersRPC;
  private categoryParams: CategoryParametersRPC;
  private pairsCache: PairsCache;

  constructor(
    assetParams: AssetParametersRPC,
    categoryParams: CategoryParametersRPC,
    pairsCache: PairsCache
  ) {
    this.assetParams = assetParams;
    this.categoryParams = categoryParams;
    this.pairsCache = pairsCache;
  }

  /**
   * Calculate blended utilization (25% asset + 75% category)
   * @returns Map of pair index to blended utilization
   */
  async getBlendedUtilization(): Promise<Map<number, Utilization>> {
    const assetUtilization = await this.assetParams.getUtilization();
    const categoryUtilization = await this.categoryParams.getUtilization();
    const pairs = await this.pairsCache.getPairsInfo();

    const blended = new Map<number, Utilization>();

    for (const [pairIndex, pairInfo] of pairs) {
      const assetUtil = assetUtilization.get(pairIndex);
      const catUtil = categoryUtilization.get(pairInfo.groupIndex);

      if (assetUtil && catUtil) {
        blended.set(pairIndex, {
          utilizationLong:
            0.25 * assetUtil.utilizationLong + 0.75 * catUtil.utilizationLong,
          utilizationShort:
            0.25 * assetUtil.utilizationShort + 0.75 * catUtil.utilizationShort,
        });
      }
    }

    return blended;
  }

  /**
   * Calculate blended skew (25% asset + 75% category)
   * @returns Map of pair index to blended skew
   */
  async getBlendedSkew(): Promise<Map<number, Skew>> {
    const assetSkew = await this.assetParams.getAssetSkew();
    const categorySkew = await this.categoryParams.getCategorySkew();
    const pairs = await this.pairsCache.getPairsInfo();

    const blended = new Map<number, Skew>();

    for (const [pairIndex, pairInfo] of pairs) {
      const assetSk = assetSkew.get(pairIndex);
      const catSk = categorySkew.get(pairInfo.groupIndex);

      if (assetSk && catSk) {
        blended.set(pairIndex, {
          skew: 0.25 * assetSk.skew + 0.75 * catSk.skew,
        });
      }
    }

    return blended;
  }
}
