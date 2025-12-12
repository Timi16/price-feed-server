import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { WebSocketHandler } from './wsHandler';

/**
 * Create and configure WebSocket server
 */
export function createWebSocketServer(httpServer: HTTPServer): WebSocketServer {
  logger.info('Setting up WebSocket server...');

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/prices',
  });

  const wsHandler = new WebSocketHandler();

  wss.on('connection', (ws: WebSocket) => {
    wsHandler.handleConnection(ws);
  });

  wss.on('error', (error) => {
    logger.error('WebSocket server error:', error);
  });

  logger.info('✅ WebSocket server ready on path: /prices');

  // Log stats every 30 seconds
  setInterval(() => {
    logger.debug(`Active WebSocket clients: ${wsHandler.getClientCount()}`);
  }, 30000);

  return wss;
}