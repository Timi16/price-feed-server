/**
 * FeedClient Service - FIXED VERSION
 * Key fixes:
 * 1. Normalize feed IDs (remove 0x prefix) before passing to FeedClient
 * 2. Add detailed logging to track subscription flow
 * 3. Ensure callbacks are properly triggered
 */

import { FeedClient } from '@perpsdk/feed/feed_client';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';
import { pairService } from './pairService';
import { PriceData } from '../types';
import { calculatePythPrice } from '../utils/priceFormatter';

export type PriceUpdateCallback = (priceData: PriceData) => void;

/**
 * Normalize feed ID: remove 0x prefix and lowercase
 */
function normalizeFeedId(feedId: string): string {
  let normalized = feedId.toLowerCase();
  if (normalized.startsWith('0x')) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

class PriceFeedService {
  private feedClient: FeedClient | null = null;
  private subscriptions: Map<string, Set<PriceUpdateCallback>> = new Map();
  private callbacks: Map<string, (priceFeed: any) => void> = new Map();
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
          this.connected = false;
        },
        () => {
          logger.warn('FeedClient connection closed — reconnecting in 5s...');
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

    let feedId = pairService.getFeedId(pair);
    if (!feedId) {
      throw new Error(`Unsupported pair: ${pair}`);
    }

    // ⭐ CRITICAL: Normalize feed ID (remove 0x prefix)
    const normalizedFeedId = normalizeFeedId(feedId);

    logger.info(`📊 Subscribing to ${pair}`);
    logger.info(`   Original feedId: ${feedId}`);
    logger.info(`   Normalized feedId: ${normalizedFeedId}`);

    if (!this.subscriptions.has(pair)) {
      this.subscriptions.set(pair, new Set());
    }
    this.subscriptions.get(pair)!.add(callback);

    let pythCallback = this.callbacks.get(pair);

    if (!pythCallback) {
      logger.info(`   Creating new Pyth callback for ${pair}`);
      
      pythCallback = (priceFeed: any) => {
        try {
          const price = calculatePythPrice(priceFeed.price.price, priceFeed.price.expo);
          const confidence = calculatePythPrice(priceFeed.price.conf, priceFeed.price.expo);

          const priceData: PriceData = {
            pair,
            price,
            confidence,
            expo: priceFeed.price.expo,
            publishTime: priceFeed.price.publish_time,
          };

          logger.info(`💰 Price update: ${pair} = $${price.toFixed(2)} ±$${confidence.toFixed(4)}`);

          const subs = this.subscriptions.get(pair);
          if (subs && subs.size > 0) {
            logger.debug(`   Broadcasting to ${subs.size} subscriber(s)`);
            subs.forEach((cb) => {
              try {
                cb(priceData);
              } catch (err) {
                logger.error(`Error in subscriber callback for ${pair}:`, err);
              }
            });
          } else {
            logger.warn(`   No subscribers found for ${pair}!`);
          }
        } catch (error) {
          logger.error(`Error processing price update for ${pair}:`, error);
        }
      };

      this.callbacks.set(pair, pythCallback);
      
      // ⭐ CRITICAL: Pass normalized feed ID to FeedClient
      logger.info(`   Registering with FeedClient using: ${normalizedFeedId}`);
      this.feedClient!.registerPriceFeedCallback(normalizedFeedId, pythCallback);
    } else {
      logger.info(`   Using existing Pyth callback for ${pair}`);
    }

    logger.info(`✅ Subscribed to ${pair} (total subscribers: ${this.subscriptions.get(pair)?.size})`);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(pair);
      if (subs) {
        subs.delete(callback);
        logger.info(`Unsubscribing client from ${pair} (${subs.size} remaining)`);
        
        if (subs.size === 0) {
          this.subscriptions.delete(pair);
          const cb = this.callbacks.get(pair);
          if (cb && this.feedClient) {
            logger.info(`No more subscribers for ${pair}, unregistering from Pyth`);
            this.feedClient.unregisterPriceFeedCallback(normalizedFeedId, cb);
            this.callbacks.delete(pair);
          }
        }
      }
    };
  }

  async getCurrentPrice(pair: string): Promise<PriceData> {
    if (!this.feedClient) throw new Error('FeedClient not initialized');

    const feedId = pairService.getFeedId(pair);
    if (!feedId) throw new Error(`Unsupported pair: ${pair}`);

    logger.info(`Fetching current price for ${pair} (feedId: ${feedId})`);
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
      publishTime: priceFeed.price.publish_time,
    };
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

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getSubscriberCount(pair: string): number {
    return this.subscriptions.get(pair)?.size || 0;
  }
}

export const priceFeedService = new PriceFeedService();