import WebSocket from "ws";
import { PriceFeedResponse, PriceFeedResponseSchema } from "../types";
import { API_ENDPOINTS } from "../config";

/**
 * Callback function type for price updates
 */
export type PriceUpdateCallback = (priceData: PriceFeedResponse) => void;

/**
 * Normalize feed ID: remove 0x prefix and lowercase
 * Pyth WebSocket sends IDs WITHOUT 0x prefix
 */
function normalizeFeedId(feedId: string): string {
  let normalized = feedId.toLowerCase();
  if (normalized.startsWith('0x')) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

/**
 * WebSocket client for real-time price feeds from Pyth Network
 */
export class FeedClient {
  private url: string;
  private ws?: WebSocket;
  private callbacks: Map<string, PriceUpdateCallback[]> = new Map();
  private onError?: (error: Error) => void;
  private onClose?: () => void;
  private pairFeedMap: Map<string, string> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(
    url: string = API_ENDPOINTS.PYTH_WS,
    onError?: (error: Error) => void,
    onClose?: () => void
  ) {
    this.url = url;
    this.onError = onError;
    this.onClose = onClose;
  }

  /**
   * Register a callback for a specific price feed
   */
  registerPriceFeedCallback(
    feedId: string,
    callback: PriceUpdateCallback
  ): void {
    const id = normalizeFeedId(feedId);
    if (!this.callbacks.has(id)) {
      this.callbacks.set(id, []);
    }
    this.callbacks.get(id)!.push(callback);

    if (this.callbacks.get(id)!.length === 1 && this.isConnected()) {
      this.subscribeToPriceFeeds([id]);
    }
  }

  /**
   * Unregister a callback for a specific price feed
   */
  unregisterPriceFeedCallback(
    feedId: string,
    callback: PriceUpdateCallback
  ): void {
    const id = normalizeFeedId(feedId);
    const cbs = this.callbacks.get(id);
    if (!cbs) return;

    const idx = cbs.indexOf(callback);
    if (idx > -1) cbs.splice(idx, 1);

    if (cbs.length === 0 && this.isConnected()) {
      this.unsubscribeFromPriceFeeds([id]);
      this.callbacks.delete(id);
    }
  }

  /**
   * Load pair to feed ID mappings
   */
  loadPairFeeds(pairFeeds: Map<string, string>): void {
    this.pairFeedMap = pairFeeds;
  }

  /**
   * Get feed ID for a trading pair
   */
  getFeedIdForPair(pairName: string): string | undefined {
    return this.pairFeedMap.get(pairName);
  }

  /**
   * Connect to WebSocket and listen for price updates
   */
  async listenForPriceUpdates(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on("open", () => {
          console.log("WebSocket connected to Pyth Network");
          this.reconnectAttempts = 0;

          const feedIds = Array.from(this.callbacks.keys());
          if (feedIds.length > 0) {
            this.subscribeToPriceFeeds(feedIds);
          }

          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());

            if (message.type !== "price_update") {
              console.log("Received non-update message:", message);
            }

            if (message.type === "price_update") {
              this.handlePriceUpdate(message);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        });

        this.ws.on("error", (error: Error) => {
          console.error("WebSocket error:", error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        });

        this.ws.on("close", () => {
          console.log("WebSocket connection closed");
          if (this.onClose) {
            this.onClose();
          }
          this.attemptReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to specific price feeds
   */
  private subscribeToPriceFeeds(feedIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Feed IDs should already be normalized, but ensure they are
    const ids = feedIds.map(id => normalizeFeedId(id));

    this.ws.send(JSON.stringify({ type: "subscribe", ids }));
    console.log("Subscribed to Pyth feeds:", ids);
  }

  /**
   * Unsubscribe from specific price feeds
   */
  private unsubscribeFromPriceFeeds(feedIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const ids = feedIds.map(id => normalizeFeedId(id));
    this.ws.send(JSON.stringify({ type: "unsubscribe", ids }));
    console.log("Unsubscribed from Pyth feeds:", ids);
  }

  /**
   * Handle incoming price update
   */
  private handlePriceUpdate(message: any): void {
    try {
      if (message.price_feed) {
        const priceUpdate = message.price_feed;

        // ⭐ KEY FIX: Normalize the incoming feed ID (Pyth sends without 0x)
        const feedId = normalizeFeedId(priceUpdate.id);

        const priceFeed = {
          id: feedId,
          price: {
            price: priceUpdate.price.price,
            conf: priceUpdate.price.conf,
            expo: priceUpdate.price.expo,
            publishTime: priceUpdate.price.publish_time,
          },
          emaPrice: {
            price: priceUpdate.ema_price.price,
            conf: priceUpdate.ema_price.conf,
            expo: priceUpdate.ema_price.expo,
            publishTime: priceUpdate.ema_price.publish_time,
          },
        };

        const validatedPriceFeed = PriceFeedResponseSchema.parse(priceFeed);

        // Trigger callbacks
        const callbacks = this.callbacks.get(validatedPriceFeed.id);
        if (callbacks && callbacks.length > 0) {
          console.log(`✅ Triggering ${callbacks.length} callback(s) for ${validatedPriceFeed.id}`);
          callbacks.forEach((callback) => {
            try {
              callback(validatedPriceFeed);
            } catch (error) {
              console.error(
                "Error in price update callback:",
                error instanceof Error ? error.message : String(error)
              );
            }
          });
        } else {
          console.warn(`⚠️ No callbacks registered for feed: ${validatedPriceFeed.id}`);
          console.log(`Registered feeds: [${Array.from(this.callbacks.keys()).join(", ")}]`);
        }
      }
    } catch (error) {
      console.error(
        "Error processing price update:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.listenForPriceUpdates().catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);
  }

  /**
   * Get latest prices via HTTP
   */
  async getLatestPriceUpdates(feedIds: string[]): Promise<any> {
    const url = `${API_ENDPOINTS.PYTH_HTTP}?ids[]=${feedIds.join("&ids[]=")}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch prices: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== undefined && this.ws.readyState === WebSocket.OPEN;
  }
}