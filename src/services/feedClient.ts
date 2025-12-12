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
  private callbacks: Map<string, (priceFeed: any) => void> = new Map(); // ✅ Store callbacks for cleanup
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

    // Initialize subscriptions set for this pair
    if (!this.subscriptions.has(pair)) {
      this.subscriptions.set(pair, new Set());
    }
    this.subscriptions.get(pair)!.add(callback);

    // ✅ Create or reuse callback for this pair
    let pythCallback = this.callbacks.get(pair);
    
    if (!pythCallback) {
      // Create new callback for this pair
      pythCallback = (priceFeed: any) => {
        try {
          logger.debug(`Raw price feed received for ${pair}:`, priceFeed);

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

          logger.info(`📊 Price update: ${pair} = $${price.toFixed(2)}`);

          // Broadcast to all subscribers for this pair
          const callbacks = this.subscriptions.get(pair);
          if (callbacks && callbacks.size > 0) {
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

      this.callbacks.set(pair, pythCallback);
      
      // ✅ Register callback with FeedClient
      logger.info(`Registering callback for feedId: ${feedId}`);
      this.feedClient.registerPriceFeedCallback(feedId, pythCallback);
    }

    logger.info(`✅ Subscribed to ${pair} (total subscribers: ${this.subscriptions.get(pair)?.size})`);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(pair);
      if (callbacks) {
        callbacks.delete(callback);

        // If no more subscribers for this pair, cleanup
        if (callbacks.size === 0) {
          this.subscriptions.delete(pair);
          
          const pythCallback = this.callbacks.get(pair);
          if (pythCallback) {
            this.feedClient?.unregisterPriceFeedCallback(feedId, pythCallback);
            this.callbacks.delete(pair);
            logger.info(`Unregistered callback for ${pair}`);
          }
          
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
      logger.info(`Fetching current price for ${pair} (feedId: ${feedId})`);
      
      const data = await this.feedClient.getLatestPriceUpdates([feedId]);

      logger.debug(`Raw price data for ${pair}:`, data);

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
      this.callbacks.clear();
      logger.info('FeedClient closed');
    }
  }

  // ✅ Debug method to check subscriptions
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getSubscriberCount(pair: string): number {
    return this.subscriptions.get(pair)?.size || 0;
  }
}

export const priceFeedService = new PriceFeedService();