import { Contract, Provider } from 'ethers';
import { ContractPairInfo, PairInfo, PairInfoSchema, PairsBackendReturn, fromBlockchain10, fromBlockchain6 } from '../types';
import { API_ENDPOINTS } from '../config';

/**
 * RPC module for caching and managing trading pair information
 */
export class PairsCache {
  private provider: Provider;
  private pairStorageContract: Contract;
  private pairsCache?: Map<number, PairInfo>;
  private pairNameToIndexMap?: Map<string, number>;

  constructor(provider: Provider, pairStorageContract: Contract) {
    this.provider = provider;
    this.pairStorageContract = pairStorageContract;
  }

  /**
   * Get all trading pairs from blockchain (with caching)
   * @param forceRefresh - Force refresh from blockchain
   * @returns Map of pair index to PairInfo
   */
  async getPairsInfo(forceRefresh: boolean = false): Promise<Map<number, PairInfo>> {
    if (this.pairsCache && !forceRefresh) {
      return this.pairsCache;
    }

    const pairs = new Map<number, PairInfo>();
    const pairNameToIndex = new Map<string, number>();

    try {
      // Get pairs count
      const pairsCount = await this.pairStorageContract.pairsCount();
      const count = Number(pairsCount);

      // Fetch all pairs
      for (let i = 0; i < count; i++) {
        const pairData = await this.getOtherPairInfoFromIndex(i);
       const pair = await this.getPairInfoNameFromIndex(i)
        const pairInfo: PairInfo = {
          from: pair.from,
          to: pair.to,
          spread: {
            min: fromBlockchain10(pairData.spreadP ),
            max: fromBlockchain10(pairData.spreadP ),
          },
          groupIndex: Number(pairData.groupIndex),
          feeIndex: Number(pairData.feeIndex),
          maxLeverage: fromBlockchain10(pairData.leverages.maxLeverage),
          maxShortOiP: fromBlockchain10( pairData.values.maxShortOiP),
          maxLongOiP: fromBlockchain10( pairData.values.maxLongOiP)
        };

        pairs.set(i, pairInfo);
        pairNameToIndex.set(`${pairInfo.from}/${pairInfo.to}`, i);
      }

      this.pairsCache = pairs;
      this.pairNameToIndexMap = pairNameToIndex;

      return pairs;
    } catch (error) {
      console.error('Error fetching pairs info from blockchain:', error);
      throw error;
    }
  }

async getPairBackend(index: number): Promise<PairsBackendReturn> {
  const [pair, group, fee] = await this.pairStorageContract.pairsBackend(index);

  const mapped: PairsBackendReturn = {
    pair: {
      feed: {
        maxOpenDeviationP: pair.feed.maxOpenDeviationP,
        maxCloseDeviationP: pair.feed.maxCloseDeviationP,
        feedId: pair.feed.feedId,
      },
      backupFeed: {
        maxDeviationP: pair.backupFeed.maxDeviationP,
        feedId: pair.backupFeed.feedId,
      },
      spreadP: pair.spreadP,
      pnlSpreadP: pair.pnlSpreadP,
      leverages: {
        minLeverage: pair.leverages.minLeverage,
        maxLeverage: pair.leverages.maxLeverage,
        pnlMinLeverage: pair.leverages.pnlMinLeverage,
        pnlMaxLeverage: pair.leverages.pnlMaxLeverage,
      },
      priceImpactMultiplier: pair.priceImpactMultiplier,
      skewImpactMultiplier: pair.skewImpactMultiplier,
      groupIndex: pair.groupIndex,
      feeIndex: pair.feeIndex,
      values: {
        maxGainP: pair[9].maxGainP,
        maxSlP: pair[9].maxSlP,
        maxLongOiP: pair[9].maxLongOiP,
        maxShortOiP: pair[9].maxShortOiP,
        groupOpenInterestPercentageP: pair[9].groupOpenInterestPercentageP,
        maxWalletOIP: pair[9].maxWalletOIP,
        isUSDCAligned: pair[9].isUSDCAligned,
      },
    },

    group: {
      name: group.name,
      maxOpenInterestP: group.maxOpenInterestP,
      isSpreadDynamic: group.isSpreadDynamic,
    },

    fee: {
      openFeeP: fee.openFeeP,
      closeFeeP: fee.closeFeeP,
      limitOrderFeeP: fee.limitOrderFeeP,
      minLevPosUSDC: fee.minLevPosUSDC,
      pnlFees: {
        numTiers: fee.pnlFees.numTiers,
        tierP: [...fee.pnlFees.tierP],
        feesP: [...fee.pnlFees.feesP],
      },
    },
  };

  return mapped;
}

   getPairInfoNameFromIndex = async (index:number) :Promise<{from:string, to:string}>=>{
    const pairData = await this.pairStorageContract.getPairData(index)
    return {
      from: pairData.from,
      to: pairData.to
    }
   }

 getOtherPairInfoFromIndex = async (index: number): Promise<ContractPairInfo> => {
  const pairData = await this.pairStorageContract.pairs(index);
const values = pairData[9]
  const result: ContractPairInfo = {
    feed: {
      maxOpenDeviationP: pairData.feed.maxOpenDeviationP,
      maxCloseDeviationP: pairData.feed.maxCloseDeviationP,
      feedId: pairData.feed.feedId,
    },
    backupFeed: {
      maxDeviationP: pairData.backupFeed.maxDeviationP,
      feedId: pairData.backupFeed.feedId,
    },
    spreadP: pairData.spreadP,
    pnlSpreadP: pairData.pnlSpreadP,
    leverages: {
      minLeverage: pairData.leverages.minLeverage,
      maxLeverage: pairData.leverages.maxLeverage,
      pnlMinLeverage: pairData.leverages.pnlMinLeverage,
      pnlMaxLeverage: pairData.leverages.pnlMaxLeverage,
    },
    priceImpactMultiplier: pairData.priceImpactMultiplier,
    skewImpactMultiplier: pairData.skewImpactMultiplier,
    groupIndex: pairData.groupIndex,
    feeIndex: pairData.feeIndex,
    values: {
      maxGainP: values.maxGainP,
      maxSlP: values.maxSlP,
      maxLongOiP: values.maxLongOiP,
      maxShortOiP: values.maxShortOiP,
      groupOpenInterestPercentageP: values.groupOpenInterestPercentageP,
      maxWalletOIP: values.maxWalletOIP,
      isUSDCAligned: values.isUSDCAligned,
    },
  };

  return result;
};


  /**
   * Get pair information from socket API
   * @returns Pair information from API
   */
  async getPairInfoFromSocket(): Promise<any> {
    try {
      const response = await fetch(API_ENDPOINTS.SOCKET_API);
      if (!response.ok) {
        throw new Error(`Failed to fetch from socket API: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching pair info from socket API:', error);
      throw error;
    }
  }

  /**
   * Get pair index from pair name
   * @param pairName - Pair name (e.g., "BTC/USD")
   * @returns Pair index or undefined if not found
   */
  async getPairIndex(pairName: string): Promise<number | undefined> {
    if (!this.pairNameToIndexMap) {
      await this.getPairsInfo();
    }
    return this.pairNameToIndexMap?.get(pairName);
  }

  /**
   * Get pair name from index
   * @param pairIndex - Pair index
   * @returns Pair name or undefined if not found
   */
  async getPairName(pairIndex: number): Promise<string | undefined> {
    if (!this.pairsCache) {
      await this.getPairsInfo();
    }
    const pair = this.pairsCache?.get(pairIndex);
    return pair ? `${pair.from}/${pair.to}` : undefined;
  }

  /**
   * Get all unique group indexes
   * @returns Array of group indexes
   */
  async getGroupIndexes(): Promise<number[]> {
    const pairs = await this.getPairsInfo();
    const groupIndexes = new Set<number>();

    pairs.forEach((pair) => {
      groupIndexes.add(pair.groupIndex);
    });

    return Array.from(groupIndexes).sort((a, b) => a - b);
  }

  /**
   * Get all pairs in a specific group
   * @param groupIndex - Group index
   * @returns Array of pair indexes in the group
   */
  async getPairsInGroup(groupIndex: number): Promise<number[]> {
    const pairs = await this.getPairsInfo();
    const pairsInGroup: number[] = [];

    pairs.forEach((pair, index) => {
      if (pair.groupIndex === groupIndex) {
        pairsInGroup.push(index);
      }
    });

    return pairsInGroup;
  }

  /**
   * Get pair info by index
   * @param pairIndex - Pair index
   * @returns PairInfo or undefined
   */
  async getPairByIndex(pairIndex: number): Promise<PairInfo | undefined> {
    const pairs = await this.getPairsInfo();
    return pairs.get(pairIndex);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.pairsCache = undefined;
    this.pairNameToIndexMap = undefined;
  }
}
