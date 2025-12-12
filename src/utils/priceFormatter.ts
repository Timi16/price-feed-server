/**
 * Calculate actual price from Pyth format
 * Pyth returns price as: actualPrice = price * 10^expo
 */
export function calculatePythPrice(price: string, expo: number): number {
  const priceNum = Number(price);
  return priceNum * Math.pow(10, expo);
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Get recommended decimals for a trading pair
 */
export function getDecimalsForPair(pair: string): number {
  const [base] = pair.split('/');
  
  // High-value assets: 2 decimals
  if (['BTC', 'ETH'].includes(base)) {
    return 2;
  }
  
  // Medium-value assets: 4 decimals
  if (['SOL', 'BNB', 'AVAX', 'LINK', 'AAVE'].includes(base)) {
    return 4;
  }
  
  // Low-value/meme coins: 6-8 decimals
  if (['SHIB', 'PEPE', 'BONK', 'WIF'].includes(base)) {
    return 8;
  }
  
  // Default: 4 decimals
  return 4;
}