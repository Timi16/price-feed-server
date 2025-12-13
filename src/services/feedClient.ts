/**
 * FeedClient Service - Uses local PerpSdk with TypeScript path mapping
 */

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
        CONFIG.PYTH.WS_URL, // already wss://hermes.pyth.network/ws
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
      logger.info('Connected to Pyth WebSocket');
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

    let pythCallback = this.callbacks.get(pair);

    if (!pythCallback) {
      pythCallback = (priceFeed: any) => {
        try {
          // CRITICAL FIX: Pyth uses snake_case → publish_time
          const price = calculatePythPrice(priceFeed.price.price, priceFeed.price.expo);
          const confidence = calculatePythPrice(priceFeed.price.conf, priceFeed.price.expo);

          const priceData: PriceData = {
            pair,
            price,
            confidence,
            expo: priceFeed.price.expo,
            publishTime: priceFeed.price.publish_time, // ← FIXED: was publishTime
          };

          logger.info(`Price update: ${pair} = $${price.toFixed(2)} ±$${confidence.toFixed(4)} @ ${new Date(priceFeed.price.publish_time * 1000).toISOString()}`);

          const subs = this.subscriptions.get(pair);
          if (subs) {
            subs.forEach((cb) => {
              try {
                cb(priceData);
              } catch (err) {
                logger.error(`Error in subscriber callback for ${pair}:`, err);
              }
            });
          }
        } catch (error) {
          logger.error(`Error processing price update for ${pair}:`, error);
        }
      };

      this.callbacks.set(pair, pythCallback);
      logger.info(`Registering Pyth callback for feedId: ${feedId}`);
      this.feedClient!.registerPriceFeedCallback(feedId.toLowerCase(), pythCallback); // ← lowercase!
    }

    logger.info(`Subscribed to ${pair} (total: ${this.subscriptions.get(pair)?.size})`);

    return () => {
      const subs = this.subscriptions.get(pair);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(pair);
          const cb = this.callbacks.get(pair);
          if (cb && this.feedClient) {
            this.feedClient.unregisterPriceFeedCallback(feedId.toLowerCase(), cb);
            this.callbacks.delete(pair);
            logger.info(`Unsubscribed from ${pair} (no more clients)`);
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
      publishTime: priceFeed.price.publish_time, // ← FIXED
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