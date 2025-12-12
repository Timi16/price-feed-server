import WebSocket from "ws";
import { z } from "zod";
import {
  ClientMessageSchema,
  ClientState,
  ErrorMessage,
  PriceData,
} from "../types";
import { logger } from "../utils/logger";
import { pairService } from "../services/pairService";
import { priceFeedService } from "../services/feedClient";

/**
 * Handle incoming WebSocket messages from clients
 */
export class WebSocketHandler {
  private clients: Map<WebSocket, ClientState> = new Map();
  private unsubscribeFunctions: Map<string, () => void> = new Map();

  /**
   * Handle new client connection
   */
  handleConnection(ws: WebSocket): void {
    const clientId = this.generateClientId();
    const clientState: ClientState = {
      id: clientId,
      subscribedPairs: new Set(),
      connectedAt: Date.now(),
    };

    this.clients.set(ws, clientState);
    logger.info(`Client ${clientId} connected (total: ${this.clients.size})`);

    // Send welcome message
    this.sendMessage(ws, {
      type: "connected",
      message: "Connected to Debonk Price Feed Server",
      supportedPairs: pairService.getAllPairs(),
      timestamp: Date.now(),
    });

    // Handle messages
    ws.on("message", (data: WebSocket.Data) => {
      this.handleMessage(ws, data, clientState);
    });

    // Handle disconnect
    ws.on("close", () => {
      this.handleDisconnect(ws, clientState);
    });

    ws.on("error", (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(
    ws: WebSocket,
    data: WebSocket.Data,
    clientState: ClientState
  ): void {
    try {
      const message = JSON.parse(data.toString());

      // Validate message
      const validatedMessage = ClientMessageSchema.parse(message);

      // ✅ FIXED: Use .pair directly (not .data.pair)
      switch (validatedMessage.type) {
        case "subscribe":
          this.handleSubscribe(ws, validatedMessage.pair, clientState);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(ws, validatedMessage.pair, clientState);
          break;

        case "get_price":
          this.handleGetPrice(ws, validatedMessage.pair);
          break;

        default:
          this.sendError(ws, "Unknown message type", "UNKNOWN_MESSAGE_TYPE");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.sendError(
          ws,
          `Invalid message format: ${error.message}`,
          "INVALID_MESSAGE"
        );
      } else {
        logger.error("Error handling message:", error);
        this.sendError(ws, "Internal server error", "INTERNAL_ERROR");
      }
    }
  }

  /**
   * Handle subscribe request
   */
  private async handleSubscribe(
    ws: WebSocket,
    pair: string,
    clientState: ClientState
  ): Promise<void> {
    try {
      // Validate pair is supported
      if (!pairService.isPairSupported(pair)) {
        this.sendError(ws, `Unsupported pair: ${pair}`, "UNSUPPORTED_PAIR");
        return;
      }

      // Check if already subscribed
      if (clientState.subscribedPairs.has(pair)) {
        logger.debug(`Client ${clientState.id} already subscribed to ${pair}`);
        return;
      }

      // Subscribe to price updates
      const unsubscribe = priceFeedService.subscribeToPair(
        pair,
        (priceData: PriceData) => {
          // Broadcast to this client
          this.sendMessage(ws, {
            type: "price_update",
            pair,
            data: priceData,
            timestamp: Date.now(),
          });
        }
      );

      // Store unsubscribe function
      const key = `${clientState.id}:${pair}`;
      this.unsubscribeFunctions.set(key, unsubscribe);

      // Add to client's subscribed pairs
      clientState.subscribedPairs.add(pair);

      // Send confirmation
      this.sendMessage(ws, {
        type: "subscribed",
        pair,
        timestamp: Date.now(),
      });

      logger.info(`Client ${clientState.id} subscribed to ${pair}`);
    } catch (error) {
      logger.error(`Error subscribing to ${pair}:`, error);
      this.sendError(
        ws,
        `Failed to subscribe to ${pair}`,
        "SUBSCRIPTION_FAILED"
      );
    }
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(
    ws: WebSocket,
    pair: string,
    clientState: ClientState
  ): void {
    if (!clientState.subscribedPairs.has(pair)) {
      logger.debug(`Client ${clientState.id} not subscribed to ${pair}`);
      return;
    }

    // Call unsubscribe function
    const key = `${clientState.id}:${pair}`;
    const unsubscribe = this.unsubscribeFunctions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribeFunctions.delete(key);
    }

    // Remove from client's subscribed pairs
    clientState.subscribedPairs.delete(pair);

    // Send confirmation
    this.sendMessage(ws, {
      type: "unsubscribed",
      pair,
      timestamp: Date.now(),
    });

    logger.info(`Client ${clientState.id} unsubscribed from ${pair}`);
  }

  /**
   * Handle one-time price fetch request
   */
  private async handleGetPrice(ws: WebSocket, pair: string): Promise<void> {
    try {
      if (!pairService.isPairSupported(pair)) {
        this.sendError(ws, `Unsupported pair: ${pair}`, "UNSUPPORTED_PAIR");
        return;
      }

      const priceData = await priceFeedService.getCurrentPrice(pair);

      this.sendMessage(ws, {
        type: "price_update",
        pair,
        data: priceData,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error(`Error fetching price for ${pair}:`, error);
      this.sendError(
        ws,
        `Failed to fetch price for ${pair}`,
        "PRICE_FETCH_FAILED"
      );
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(ws: WebSocket, clientState: ClientState): void {
    // Unsubscribe from all pairs
    clientState.subscribedPairs.forEach((pair) => {
      const key = `${clientState.id}:${pair}`;
      const unsubscribe = this.unsubscribeFunctions.get(key);
      if (unsubscribe) {
        unsubscribe();
        this.unsubscribeFunctions.delete(key);
      }
    });

    this.clients.delete(ws);
    logger.info(
      `Client ${clientState.id} disconnected (total: ${this.clients.size})`
    );
  }

  /**
   * Send message to client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to client
   */
  private sendError(ws: WebSocket, message: string, code?: string): void {
    const errorMessage: ErrorMessage = {
      type: "error",
      message,
      code,
      timestamp: Date.now(),
    };
    this.sendMessage(ws, errorMessage);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}