import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Base RPC for Avantis SDK
  BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com',
  
  // Pyth Network
  PYTH: {
    WS_URL: process.env.PYTH_WS_URL || 'wss://hermes.pyth.network/ws',
    HTTP_URL: process.env.PYTH_HTTP_URL || 'https://hermes.pyth.network/v2/updates/price/latest',
  },
  
  // CORS
  CORS: {
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;

export const isDevelopment = CONFIG.NODE_ENV === 'development';
export const isProduction = CONFIG.NODE_ENV === 'production';