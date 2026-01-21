import { Contract, Provider } from 'ethers';
import { Snapshot, Group, PairData, PairsBackendReturn, fromBlockchain10, fromBlockchain6, fromBlockchain12 } from '../types';
import { PairsCache } from './pairs_cache';
import { AssetParametersRPC } from './asset_parameters';
import { CategoryParametersRPC } from './category_parameters';
import { FeeParametersRPC } from './fee_parameters';
import { BlendedRPC } from './blended';

/**
 * RPC module for aggregating all market data into a snapshot
 * Optimized to use getPairBackend() to reduce duplicate contract calls
 */
export class SnapshotRPC {
  private pairsCache: PairsCache;
  private assetParams: AssetParametersRPC;
  private categoryParams: CategoryParametersRPC;
  private feeParams: FeeParametersRPC;
  private blendedParams: BlendedRPC;

  constructor(
    pairsCache: PairsCache,
    assetParams: AssetParametersRPC,
    categoryParams: CategoryParametersRPC,
    feeParams: FeeParametersRPC,
    blendedParams: BlendedRPC
  ) {
    this.pairsCache = pairsCache;
    this.assetParams = assetParams;
    this.categoryParams = categoryParams;
    this.feeParams = feeParams;
    this.blendedParams = blendedParams;
  }

  /**
   * Get comprehensive market snapshot with all data
   * Optimized to use getPairBackend() to reduce contract calls
   * @returns Snapshot object containing all market parameters
   */
  async getSnapshot(): Promise<Snapshot> {
    console.log('Fetching market snapshot (optimized)...');

    // Get basic pair info first to know how many pairs exist
    const pairs = await this.pairsCache.getPairsInfo();
    const pairIndices = Array.from(pairs.keys());

    // Fetch all pair backend data in parallel (includes pair config, group info, and fees)
    const pairBackendPromises = pairIndices.map(idx => this.pairsCache.getPairBackend(idx));

    // Fetch only the dynamic data that changes (OI, utilization, skew, depth)
    // Note: Category-level metrics may not be available if contract methods don't exist
    const [
      pairBackendData,
      assetOI,
      assetUtilization,
      assetSkew,
      blendedUtilization,
      blendedSkew,
      depth,
    ] = await Promise.all([
      Promise.all(pairBackendPromises),
      this.assetParams.getOI(),
      this.assetParams.getUtilization(),
      this.assetParams.getAssetSkew(),
      this.blendedParams.getBlendedUtilization(),
      this.blendedParams.getBlendedSkew(),
      this.assetParams.getOnePercentDepth(),
    ]);

    // Try to get category data, but don't fail if it's not available
    let categoryOI = new Map();
    let categoryUtilization = new Map();
    let categorySkew = new Map();

    try {
      categoryOI = await this.categoryParams.getOI();
      categoryUtilization = await this.categoryParams.getUtilization();
      categorySkew = await this.categoryParams.getCategorySkew();
    } catch (error) {
      console.warn('Category-level metrics not available:', error);
    }

    // Build a map of pairIndex -> backend data
    const backendDataMap = new Map<number, PairsBackendReturn>();
    pairIndices.forEach((idx, i) => {
      backendDataMap.set(idx, pairBackendData[i]);
    });

    // Build a map of groupIndex -> group info (from backend data)
    const groupInfoMap = new Map<number, { name: string; maxOpenInterestP: bigint; isSpreadDynamic: boolean }>();
    pairBackendData.forEach(data => {
      const groupIdx = Number(data.pair.groupIndex);
      if (!groupInfoMap.has(groupIdx)) {
        groupInfoMap.set(groupIdx, data.group);
      }
    });

    // Build snapshot structure
    const snapshot: Snapshot = {
      groups: {},
    };

    // Group pairs by category
    for (const [groupIndex, groupInfo] of groupInfoMap) {
      const group: Group = {
        groupIndex,
        pairs: {},
        openInterest: categoryOI.get(groupIndex),
        utilization: categoryUtilization.get(groupIndex),
        skew: categorySkew.get(groupIndex),
      };

      // Get all pairs in this group
      const pairsInGroup = pairIndices.filter(idx => {
        const backend = backendDataMap.get(idx);
        return backend && Number(backend.pair.groupIndex) === groupIndex;
      });

      for (const pairIndex of pairsInGroup) {
        const pairInfo = pairs.get(pairIndex);
        const backend = backendDataMap.get(pairIndex);
        if (!pairInfo || !backend) continue;

        const pairName = `${pairInfo.from}/${pairInfo.to}`;

        // Extract fee data from backend (no separate call needed)
        const feeData = {
          feeP: fromBlockchain12(backend.fee.openFeeP), // Using openFeeP as the main fee
        };

        const pairData: PairData = {
          pairInfo,
          openInterest: assetOI.get(pairIndex),
          utilization: blendedUtilization.get(pairIndex),
          skew: blendedSkew.get(pairIndex),
          fee: feeData,
          depth: {
            onePercentDepthAboveUsdc: depth.get(pairIndex)?.above || 0,
            onePercentDepthBelowUsdc: depth.get(pairIndex)?.below || 0,
          },
          spread: fromBlockchain10(backend.pair.spreadP), // Use spread from backend
        };

        group.pairs[pairName] = pairData;
      }

      snapshot.groups[`group_${groupIndex}`] = group;
    }

    console.log('Market snapshot complete (optimized)');
    return snapshot;
  }

  /**
   * Get snapshot for a specific group
   * @param groupIndex - Group index
   * @returns Group data
   */
  async getGroupSnapshot(groupIndex: number): Promise<Group | undefined> {
    const snapshot = await this.getSnapshot();
    return snapshot.groups[`group_${groupIndex}`];
  }

  /**
   * Get snapshot for a specific pair
   * @param pairName - Pair name (e.g., "BTC/USD")
   * @returns Pair data
   */
  async getPairSnapshot(pairName: string): Promise<PairData | undefined> {
    const snapshot = await this.getSnapshot();

    // Find the pair in all groups
    for (const group of Object.values(snapshot.groups)) {
      if (group.pairs[pairName]) {
        return group.pairs[pairName];
      }
    }

    return undefined;
  }

  /**
   * Get full backend data for a specific pair (includes all pair config, group, and fee info)
   * This provides more detailed information than the standard snapshot
   * @param pairIndex - Pair index
   * @returns Complete backend data for the pair
   */
  async getPairFullData(pairIndex: number): Promise<PairsBackendReturn> {
    return await this.pairsCache.getPairBackend(pairIndex);
  }

  /**
   * Get full backend data for all pairs
   * Useful for getting complete configuration data in one call
   * @returns Map of pair index to full backend data
   */
  async getAllPairsFullData(): Promise<Map<number, PairsBackendReturn>> {
    const pairs = await this.pairsCache.getPairsInfo();
    const pairIndices = Array.from(pairs.keys());

    const backendDataPromises = pairIndices.map(idx => this.pairsCache.getPairBackend(idx));
    const backendData = await Promise.all(backendDataPromises);

    const dataMap = new Map<number, PairsBackendReturn>();
    pairIndices.forEach((idx, i) => {
      dataMap.set(idx, backendData[i]);
    });

    return dataMap;
  }
}
