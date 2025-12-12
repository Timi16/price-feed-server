/**
 * Pair Service - Uses local PerpSdk with TypeScript path mapping
 */

// ✅ Use path alias instead of relative import
import { TraderClient } from '@perpsdk/client';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';
import { PythFeedMapping } from '../types';

/**
 * Service to fetch Pyth feed IDs from Avantis contracts using local SDK
 */
class PairService {
  private client: TraderClient | null = null;
  private feedMappings: Map<string, PythFeedMapping> = new Map();
  private feedIdToPair: Map<string, string> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('PairService already initialized');
      return;
    }

    try {
      logger.info('Initializing TraderClient from local PerpSdk...');
      this.client = new TraderClient(CONFIG.BASE_RPC_URL);

      logger.info('Fetching Pyth feed IDs from Avantis contracts...');
      await this.loadPairMappings();

      this.initialized = true;
      logger.info(`✅ Loaded ${this.feedMappings.size} trading pairs with Pyth feed IDs`);
    } catch (error) {
      logger.error('Failed to initialize PairService:', error);
      throw error;
    }
  }

  private async loadPairMappings(): Promise<void> {
    if (!this.client) {
      throw new Error('TraderClient not initialized');
    }

    const allPairs = await this.client.pairsCache.getPairsInfo();
    logger.info(`Found ${allPairs.size} pairs in Avantis contracts`);

    for (const [pairIndex, pairInfo] of allPairs) {
      try {
        const pairData = await this.client.pairsCache.getPairBackend(pairIndex);
        const pairName = `${pairInfo.from}/${pairInfo.to}`;
        const feedId = pairData.pair.feed.feedId;

        const mapping: PythFeedMapping = {
          pair: pairName,
          feedId: feedId,
          pairIndex: pairIndex,
        };

        this.feedMappings.set(pairName, mapping);
        
        const normalizedFeedId = feedId.toLowerCase().startsWith('0x')
          ? feedId.toLowerCase()
          : `0x${feedId.toLowerCase()}`;
        this.feedIdToPair.set(normalizedFeedId, pairName);

        logger.debug(`Loaded ${pairName}: ${feedId}`);
      } catch (error) {
        logger.warn(`Failed to load pair index ${pairIndex}:`, error);
      }
    }
  }

  getFeedId(pair: string): string | undefined {
    const mapping = this.feedMappings.get(pair);
    return mapping?.feedId;
  }

  getPairFromFeedId(feedId: string): string | undefined {
    const normalizedFeedId = feedId.toLowerCase().startsWith('0x')
      ? feedId.toLowerCase()
      : `0x${feedId.toLowerCase()}`;
    
    return this.feedIdToPair.get(normalizedFeedId);
  }

  getAllPairs(): string[] {
    return Array.from(this.feedMappings.keys());
  }

  getAllMappings(): PythFeedMapping[] {
    return Array.from(this.feedMappings.values());
  }

  isPairSupported(pair: string): boolean {
    return this.feedMappings.has(pair);
  }

  getPairInfo(pair: string): PythFeedMapping | undefined {
    return this.feedMappings.get(pair);
  }
}

export const pairService = new PairService();