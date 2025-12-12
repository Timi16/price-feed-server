import { z } from 'zod';

/**
 * ============================================
 * CLIENT MESSAGE SCHEMAS (Frontend → Server)
 * ============================================
 */

// Subscribe to a pair
export const SubscribeMessageSchema = z.object({
  type: z.literal('subscribe'),
  pair: z.string().min(1),
});

export type SubscribeMessage = z.infer<typeof SubscribeMessageSchema>;

// Unsubscribe from a pair
export const UnsubscribeMessageSchema = z.object({
  type: z.literal('unsubscribe'),
  pair: z.string().min(1),
});

export type UnsubscribeMessage = z.infer<typeof UnsubscribeMessageSchema>;

// Get current price (one-time fetch)
export const GetPriceMessageSchema = z.object({
  type: z.literal('get_price'),
  pair: z.string().min(1),
});

export type GetPriceMessage = z.infer<typeof GetPriceMessageSchema>;

// Union of all possible client messages
export const ClientMessageSchema = z.discriminatedUnion('type', [
  SubscribeMessageSchema,
  UnsubscribeMessageSchema,
  GetPriceMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/**
 * ============================================
 * PRICE DATA SCHEMAS
 * ============================================
 */

export const PriceDataSchema = z.object({
  pair: z.string(),
  price: z.number(),
  confidence: z.number(),
  expo: z.number(),
  publishTime: z.number(),
});

export type PriceData = z.infer<typeof PriceDataSchema>;

/**
 * ============================================
 * SERVER RESPONSE SCHEMAS (Server → Frontend)
 * ============================================
 */

// Connected message
export const ConnectedMessageSchema = z.object({
  type: z.literal('connected'),
  message: z.string(),
  supportedPairs: z.array(z.string()),
  timestamp: z.number(),
});

export type ConnectedMessage = z.infer<typeof ConnectedMessageSchema>;

// Price update message
export const PriceUpdateMessageSchema = z.object({
  type: z.literal('price_update'),
  pair: z.string(),
  data: PriceDataSchema,
  timestamp: z.number(),
});

export type PriceUpdateMessage = z.infer<typeof PriceUpdateMessageSchema>;

// Subscribed confirmation
export const SubscribedMessageSchema = z.object({
  type: z.literal('subscribed'),
  pair: z.string(),
  timestamp: z.number(),
});

export type SubscribedMessage = z.infer<typeof SubscribedMessageSchema>;

// Unsubscribed confirmation
export const UnsubscribedMessageSchema = z.object({
  type: z.literal('unsubscribed'),
  pair: z.string(),
  timestamp: z.number(),
});

export type UnsubscribedMessage = z.infer<typeof UnsubscribedMessageSchema>;

// Error message
export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
  timestamp: z.number(),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

/**
 * ============================================
 * INTERNAL TYPES
 * ============================================
 */

// Pyth feed mapping
export interface PythFeedMapping {
  pair: string;
  feedId: string;
  pairIndex: number;
}

// Client connection state
export interface ClientState {
  id: string;
  subscribedPairs: Set<string>;
  connectedAt: number;
}