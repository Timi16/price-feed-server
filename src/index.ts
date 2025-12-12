import express from 'express';
import cors from 'cors';
import { pairService } from './services/pairService';
import { priceFeedService } from './services/feedClient';
import { createWebSocketServer } from './websocket/wsServer';
import { CONFIG } from './config';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Pair categories
const PAIR_CATEGORIES = {
  CRYPTO: [
    'BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'XRP/USD', 'AVAX/USD',
    'LINK/USD', 'NEAR/USD', 'INJ/USD', 'SUI/USD', 'APT/USD', 'TAO/USD',
    'AAVE/USD', 'LDO/USD', 'OP/USD', 'ARB/USD', 'POL/USD', 'ZK/USD',
    'ZRO/USD', 'EIGEN/USD', 'TIA/USD', 'SEI/USD', 'DYM/USD', 'HYPE/USD',
    'BERA/USD', 'ZEC/USD', 'XMR/USD'
  ],
  MEME: [
    'DOGE/USD', 'SHIB/USD', 'PEPE/USD', 'BONK/USD', 'WIF/USD', 'BRETT/USD',
    'POPCAT/USD', 'GOAT/USD', 'TRUMP/USD', 'FARTCOIN/USD', 'CHILLGUY/USD',
    'PENGU/USD', 'MON/USD'
  ],
  AI: [
    'WLD/USD', 'FET/USD', 'ARKM/USD', 'RENDER/USD', 'VIRTUAL/USD', 'KAITO/USD'
  ],
  DEFI: [
    'PENDLE/USD', 'ONDO/USD', 'ENA/USD', 'AERO/USD', 'ETHFI/USD', 'JUP/USD',
    'REZ/USD', 'AVNT/USD', 'ASTER/USD', 'XPL/USD'
  ],
  NFT: [
    'APE/USD', 'ZORA/USD'
  ],
  LAYER1: [
    'ORDI/USD', 'STX/USD'
  ],
  FOREX: [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'USD/SEK',
    'AUD/USD', 'NZD/USD', 'USD/SGD', 'USD/TRY', 'USD/CNH', 'USD/INR',
    'USD/KRW', 'USD/MXN', 'USD/ZAR', 'USD/BRL', 'USD/IDR', 'USD/TWD'
  ],
  COMMODITIES: [
    'XAU/USD', 'XAG/USD', 'USOILSPOT/USD'
  ],
  STOCKS: [
    'SPY/USD', 'QQQ/USD', 'COIN/USD', 'NVDA/USD', 'AAPL/USD', 'AMZN/USD',
    'MSFT/USD', 'META/USD', 'TSLA/USD', 'GOOG/USD', 'HOOD/USD'
  ],
  OTHER: [
    'PUMP/USD'
  ]
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    pythConnected: priceFeedService.isConnected(),
    supportedPairs: pairService.getAllPairs().length
  });
});

// Get all pairs (categorized)
app.get('/pairs', async (req, res) => {
  try {
    const allPairs = pairService.getAllPairs();

    // Organize pairs by category
    const categorizedPairs: any = {
      crypto: [],
      meme: [],
      ai: [],
      defi: [],
      nft: [],
      layer1: [],
      forex: [],
      commodities: [],
      stocks: [],
      other: []
    };

    // Sort each pair into its category
    allPairs.forEach(pair => {
      let categorized = false;

      if (PAIR_CATEGORIES.CRYPTO.includes(pair)) {
        categorizedPairs.crypto.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.MEME.includes(pair)) {
        categorizedPairs.meme.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.AI.includes(pair)) {
        categorizedPairs.ai.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.DEFI.includes(pair)) {
        categorizedPairs.defi.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.NFT.includes(pair)) {
        categorizedPairs.nft.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.LAYER1.includes(pair)) {
        categorizedPairs.layer1.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.FOREX.includes(pair)) {
        categorizedPairs.forex.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.COMMODITIES.includes(pair)) {
        categorizedPairs.commodities.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.STOCKS.includes(pair)) {
        categorizedPairs.stocks.push(pair);
        categorized = true;
      }
      if (PAIR_CATEGORIES.OTHER.includes(pair)) {
        categorizedPairs.other.push(pair);
        categorized = true;
      }

      // If not in any category, add to other
      if (!categorized) {
        categorizedPairs.other.push(pair);
      }
    });

    res.json({
      success: true,
      categories: {
        crypto: {
          name: 'Crypto',
          description: 'Major cryptocurrencies',
          pairs: categorizedPairs.crypto,
          count: categorizedPairs.crypto.length
        },
        meme: {
          name: 'Meme Coins',
          description: 'Community-driven meme tokens',
          pairs: categorizedPairs.meme,
          count: categorizedPairs.meme.length
        },
        ai: {
          name: 'AI & Machine Learning',
          description: 'AI-powered crypto projects',
          pairs: categorizedPairs.ai,
          count: categorizedPairs.ai.length
        },
        defi: {
          name: 'DeFi',
          description: 'Decentralized finance protocols',
          pairs: categorizedPairs.defi,
          count: categorizedPairs.defi.length
        },
        nft: {
          name: 'NFT & Gaming',
          description: 'NFT and gaming tokens',
          pairs: categorizedPairs.nft,
          count: categorizedPairs.nft.length
        },
        layer1: {
          name: 'Layer 1 & Infrastructure',
          description: 'Blockchain infrastructure',
          pairs: categorizedPairs.layer1,
          count: categorizedPairs.layer1.length
        },
        forex: {
          name: 'Forex',
          description: 'Foreign exchange pairs',
          pairs: categorizedPairs.forex,
          count: categorizedPairs.forex.length
        },
        commodities: {
          name: 'Commodities',
          description: 'Gold, silver, oil',
          pairs: categorizedPairs.commodities,
          count: categorizedPairs.commodities.length
        },
        stocks: {
          name: 'Stocks',
          description: 'US stock market indices',
          pairs: categorizedPairs.stocks,
          count: categorizedPairs.stocks.length
        },
        other: {
          name: 'Other',
          description: 'Miscellaneous pairs',
          pairs: categorizedPairs.other,
          count: categorizedPairs.other.length
        }
      },
      totalPairs: allPairs.length,
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error('Error in GET /pairs:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Internal server error' 
    });
  }
});

// Get feed ID for a specific pair
app.get('/pairs/:pair/feed-id', (req, res) => {
  try {
    const { pair } = req.params;
    const feedId = pairService.getFeedId(pair);

    if (!feedId) {
      return res.status(404).json({
        success: false,
        error: 'Pair not found',
        pair
      });
    }

    res.json({
      success: true,
      pair,
      feedId
    });
  } catch (error: any) {
    logger.error('Error in GET /pairs/:pair/feed-id:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get current price for a pair (HTTP)
app.get('/price/:pair', async (req, res) => {
  try {
    const { pair } = req.params;

    if (!pairService.isPairSupported(pair)) {
      return res.status(404).json({
        success: false,
        error: 'Pair not supported',
        pair
      });
    }

    const priceData = await priceFeedService.getCurrentPrice(pair);

    res.json({
      success: true,
      pair,
      price: priceData.price,
      confidence: priceData.confidence,
      expo: priceData.expo,
      publishTime: priceData.publishTime,
      timestamp: Date.now()
    });
  } catch (error: any) {
    logger.error(`Error fetching price for ${req.params.pair}:`, error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Initialize services and start server
async function start() {
  try {
    logger.info('🚀 Starting Debonk Price Feed Server...');
    logger.info(`Environment: ${CONFIG.NODE_ENV}`);
    logger.info(`Port: ${CONFIG.PORT}`);

    // Step 1: Initialize Pair Service (load Pyth feed IDs)
    logger.info('Step 1: Initializing Pair Service (Avantis SDK)...');
    await pairService.initialize();

    // Step 2: Connect to Pyth WebSocket
    logger.info('Step 2: Connecting to Pyth Network...');
    await priceFeedService.initialize();

    // Step 3: Setup HTTP server
    logger.info('Step 3: Setting up HTTP server...');
    const httpServer = app.listen(CONFIG.PORT, () => {
      logger.info('\n═══════════════════════════════════════════');
      logger.info('🎉 Price Feed Server is RUNNING!');
      logger.info('═══════════════════════════════════════════');
      logger.info(`📍 HTTP:      http://localhost:${CONFIG.PORT}`);
      logger.info(`🔌 WebSocket: ws://localhost:${CONFIG.PORT}/prices`);
      logger.info(`📊 Pairs:     ${pairService.getAllPairs().length} supported`);
      logger.info('═══════════════════════════════════════════');
      logger.info('\nAvailable endpoints:');
      logger.info('  GET  /health              - Health check');
      logger.info('  GET  /pairs               - List all supported pairs (categorized)');
      logger.info('  GET  /pairs/:pair/feed-id - Get Pyth feed ID for pair');
      logger.info('  GET  /price/:pair         - Get current price');
      logger.info('  WS   /prices              - Real-time price feed');
    });

    // Step 4: Setup WebSocket server
    logger.info('Step 4: Setting up WebSocket server...');
    createWebSocketServer(httpServer);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      priceFeedService.close();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      priceFeedService.close();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();