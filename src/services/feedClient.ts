/**
 * FeedClient Service - Uses local PerpSdk with TypeScript path mapping
 */

// ✅ Use path alias instead of relative import
import { FeedClient } from '@perpsdk/feed/feed_client';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';
import { pairService } from './pairService';
import { PriceData } from '../types';
import { calculatePythPrice } from '../utils/priceFormatter';

export type PriceUpdateCallback = (priceData: PriceData) => void;

class PriceFeedService {
  private feedClient: FeedClient | null = null;
  private subscriptions: Map<string, Set<PriceUpdateCallback>> = new Map();
  private connected = false;

  async initialize(): Promise<void> {
    if (this.connected) {
      logger.warn('PriceFeedService already connected');
      return;
    }

    try {
      logger.info('Initializing FeedClient from local PerpSdk...');
      
      this.feedClient = new FeedClient(
        CONFIG.PYTH.WS_URL,
        (error) => {
          logger.error('FeedClient error:', error);
        },
        () => {
          logger.warn('FeedClient connection closed');
          this.connected = false;
          setTimeout(() => this.initialize(), 5000);
        }
      );

      logger.info('Connecting to Pyth WebSocket...');
      await this.feedClient.listenForPriceUpdates();

      this.connected = true;
      logger.info('✅ Connected to Pyth WebSocket');
    } catch (error) {
      logger.error('Failed to connect to Pyth WebSocket:', error);
      throw error;
    }
  }

  subscribeToPair(pair: string, callback: PriceUpdateCallback): () => void {
    if (!this.feedClient || !this.connected) {
      throw new Error('FeedClient not connected');
    }

    const feedId = pairService.getFeedId(pair);
    if (!feedId) {
      throw new Error(`Unsupported pair: ${pair}`);
    }

    logger.info(`Subscribing to ${pair} (feedId: ${feedId})`);

    if (!this.subscriptions.has(pair)) {
      this.subscriptions.set(pair, new Set());
    }
    this.subscriptions.get(pair)!.add(callback);

    const pythCallback = (priceFeed: any) => {
      try {
        const price = calculatePythPrice(
          priceFeed.price.price,
          priceFeed.price.expo
        );

        const confidence = calculatePythPrice(
          priceFeed.price.conf,
          priceFeed.price.expo
        );

        const priceData: PriceData = {
          pair,
          price,
          confidence,
          expo: priceFeed.price.expo,
          publishTime: priceFeed.price.publishTime,
        };

        logger.debug(`Price update: ${pair} = $${price.toFixed(2)}`);

        const callbacks = this.subscriptions.get(pair);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try {
              cb(priceData);
            } catch (error) {
              logger.error(`Error in price callback for ${pair}:`, error);
            }
          });
        }
      } catch (error) {
        logger.error(`Error processing price update for ${pair}:`, error);
      }
    };

    this.feedClient.registerPriceFeedCallback(feedId, pythCallback);

    logger.info(`✅ Subscribed to ${pair}`);

    return () => {
      const callbacks = this.subscriptions.get(pair);
      if (callbacks) {
        callbacks.delete(callback);

        if (callbacks.size === 0) {
          this.subscriptions.delete(pair);
          this.feedClient?.unregisterPriceFeedCallback(feedId, pythCallback);
          logger.info(`Unsubscribed from ${pair}`);
        }
      }
    };
  }

  async getCurrentPrice(pair: string): Promise<PriceData> {
    if (!this.feedClient) {
      throw new Error('FeedClient not initialized');
    }

    const feedId = pairService.getFeedId(pair);
    if (!feedId) {
      throw new Error(`Unsupported pair: ${pair}`);
    }

    try {
      const data = await this.feedClient.getLatestPriceUpdates([feedId]);

      if (!data.parsed || data.parsed.length === 0) {
        throw new Error(`No price data for ${pair}`);
      }

      const priceFeed = data.parsed[0];
      const price = calculatePythPrice(priceFeed.price.price, priceFeed.price.expo);
      const confidence = calculatePythPrice(priceFeed.price.conf, priceFeed.price.expo);

      return {
        pair,
        price,
        confidence,
        expo: priceFeed.price.expo,
        publishTime: priceFeed.price.publishTime,
      };
    } catch (error) {
      logger.error(`Error fetching current price for ${pair}:`, error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected && this.feedClient?.isConnected() === true;
  }

  close(): void {
    if (this.feedClient) {
      this.feedClient.close();
      this.connected = false;
      this.subscriptions.clear();
      logger.info('FeedClient closed');
    }
  }
}

export const priceFeedService = new PriceFeedService();