import express from 'express';
import cors from 'cors';
import http from 'http';
import { CONFIG } from './config';
import { logger } from './utils/logger';
import { pairService } from './services/pairService';
import { priceFeedService } from './services/feedClient';
import { createWebSocketServer } from './websocket/wsServer';

/**
 * Initialize and start the price feed server
 */
async function main() {
  try {
    logger.info('🚀 Starting Debonk Price Feed Server...');
    logger.info(`Environment: ${CONFIG.NODE_ENV}`);
    logger.info(`Port: ${CONFIG.PORT}`);

    // ============================================
    // 1. Initialize Avantis SDK and load pairs
    // ============================================
    logger.info('Step 1: Initializing Pair Service (Avantis SDK)...');
    await pairService.initialize();

    // ============================================
    // 2. Connect to Pyth WebSocket
    // ============================================
    logger.info('Step 2: Connecting to Pyth Network...');
    await priceFeedService.initialize();

    // ============================================
    // 3. Setup Express HTTP server
    // ============================================
    logger.info('Step 3: Setting up HTTP server...');
    const app = express();

    // Middleware
    app.use(cors({
      origin: CONFIG.CORS.ALLOWED_ORIGINS,
      credentials: true,
    }));
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        pythConnected: priceFeedService.isConnected(),
        supportedPairs: pairService.getAllPairs().length,
      });
    });

    // Get all supported pairs
    app.get('/pairs', (req, res) => {
      const pairs = pairService.getAllPairs();
      res.json({
        success: true,
        pairs,
        count: pairs.length,
      });
    });

    // Get Pyth feed ID for a specific pair
    app.get('/pairs/:pair/feed-id', (req, res) => {
      const { pair } = req.params;
      const feedId = pairService.getFeedId(pair);

      if (!feedId) {
        return res.status(404).json({
          success: false,
          error: `Pair not found: ${pair}`,
        });
      }

      res.json({
        success: true,
        pair,
        feedId,
      });
    });

    // Get current price for a pair (HTTP)
    app.get('/price/:pair', async (req, res) => {
      try {
        const { pair } = req.params;

        if (!pairService.isPairSupported(pair)) {
          return res.status(404).json({
            success: false,
            error: `Unsupported pair: ${pair}`,
          });
        }

        const priceData = await priceFeedService.getCurrentPrice(pair);

        res.json({
          success: true,
          ...priceData,
        });
      } catch (error: any) {
        logger.error('Error fetching price:', error);
        res.status(500).json({
          success: false,
          error: error.message || 'Internal server error',
        });
      }
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
      });
    });

    // Error handler
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    });

    // ============================================
    // 4. Create HTTP server
    // ============================================
    const httpServer = http.createServer(app);

    // ============================================
    // 5. Setup WebSocket server
    // ============================================
    logger.info('Step 4: Setting up WebSocket server...');
    createWebSocketServer(httpServer);

    // ============================================
    // 6. Start listening
    // ============================================
    httpServer.listen(CONFIG.PORT, () => {
      logger.info('');
      logger.info('═══════════════════════════════════════════');
      logger.info('🎉 Price Feed Server is RUNNING!');
      logger.info('═══════════════════════════════════════════');
      logger.info(`📍 HTTP:      http://localhost:${CONFIG.PORT}`);
      logger.info(`🔌 WebSocket: ws://localhost:${CONFIG.PORT}/prices`);
      logger.info(`📊 Pairs:     ${pairService.getAllPairs().length} supported`);
      logger.info('═══════════════════════════════════════════');
      logger.info('');
      logger.info('Available endpoints:');
      logger.info(`  GET  /health              - Health check`);
      logger.info(`  GET  /pairs               - List all supported pairs`);
      logger.info(`  GET  /pairs/:pair/feed-id - Get Pyth feed ID for pair`);
      logger.info(`  GET  /price/:pair         - Get current price`);
      logger.info(`  WS   /prices              - Real-time price feed`);
      logger.info('');
    });

    // Graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    function shutdown() {
      logger.info('Shutting down gracefully...');
      priceFeedService.close();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
main();