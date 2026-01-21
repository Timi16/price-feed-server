import { Contract, ethers, Provider, TransactionRequest } from 'ethers';
import {
  TradeInput,
  TradeResponse,
  MarginUpdateType,
  toBlockchain6,
  toBlockchain10,
  fromBlockchain6,
  fromBlockchain10,
} from '../types';
import { PairsCache } from './pairs_cache';

/**
 * RPC module for trading operations
 */
export class TradeRPC {
  private provider: Provider;
  private tradingContract: Contract;
  private tradingStorageContract: Contract;
  private pairsCache: PairsCache;

  constructor(
    provider: Provider,
    tradingContract: Contract,
    tradingStorageContract: Contract,
    pairsCache: PairsCache
  ) {
    this.provider = provider;
    this.tradingContract = tradingContract;
    this.tradingStorageContract = tradingStorageContract;
    this.pairsCache = pairsCache;
  }

  /**
   * Build transaction to open a trade
   * @param tradeInput - Trade input parameters
   * @returns Transaction request
   */
  async buildTradeOpenTx(tradeInput: TradeInput, trader:string): Promise<TransactionRequest> {
    // const pairIndex = await this.pairsCache.getPairIndex(tradeInput.pair);
    const pairIndex = 1
    console.log("pairIndex", pairIndex);
    if (pairIndex === undefined) {
      throw new Error(`Pair ${tradeInput.pair} not found`);
    }

   const sl = toBlockchain10(tradeInput.sl);
   console.log("sl", sl);
   const tp = toBlockchain10(tradeInput.tp);
    console.log("tp", tp);
   const leverage = toBlockchain10(tradeInput.leverage);
    console.log("leverage", leverage);
   const openPrice = toBlockchain10(tradeInput.openPrice);
    console.log("openPrice", openPrice);
   // positionSizeUSDC is actually the collateral amount, not position size
   const positionSizeUsdc = toBlockchain6(tradeInput.collateralInTrade);
    console.log("positionSizeUsdc", positionSizeUsdc);
    
    const trade = {
      trader,
      pairIndex: pairIndex,
      index: 0,
      initialPosToken: 0,
      positionSizeUSDC: positionSizeUsdc,
      openPrice: openPrice,
      buy: tradeInput.isLong,
      leverage: leverage,
      tp: tp,
      sl: sl,
      timestamp: 0,
    };
    
console.log("trade", trade);
    const orderType = this.getOrderTypeValue(tradeInput.orderType);
    console.log("orderType", orderType);
    const slippageP = toBlockchain10(tradeInput.maxSlippageP);
    console.log("slippageP", slippageP);
    // const executionFee = await this.getTradeExecutionFee();
const value = ethers.parseEther("0.00035");
console.log("execution fee (wei)", value);
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('openTrade', [
        trade,
        orderType,
        slippageP,
        // tradeInput.referrer || '0x0000000000000000000000000000000000000000',
      ]),
      value: value,
    };
  }

  /**
   * Build transaction to open a trade via delegation
   * @param tradeInput - Trade input parameters
   * @param trader - Trader address
   * @returns Transaction request
   */
  async buildTradeOpenTxDelegate(
    tradeInput: TradeInput,
    trader: string
  ): Promise<TransactionRequest> {
    const tx = await this.buildTradeOpenTx(tradeInput, trader);
    // Add delegation logic if needed
    return tx;
  }

  /**
   * Build transaction to close a trade
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @returns Transaction request
   */
  async buildTradeCloseTx(
    pairIndex: number,
    tradeIndex: number
  ): Promise<TransactionRequest> {
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('closeTradeMarket', [
        pairIndex,
        tradeIndex,
      ]),
    };
  }

  /**
   * Build transaction to close a trade via delegation
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @param trader - Trader address
   * @returns Transaction request
   */
  async buildTradeCloseTxDelegate(
    pairIndex: number,
    tradeIndex: number,
    trader: string
  ): Promise<TransactionRequest> {
    const tx = await this.buildTradeCloseTx(pairIndex, tradeIndex);
    // Add delegation logic if needed
    return tx;
  }

  /**
   * Build transaction to cancel a pending order
   * @param pairIndex - Pair index
   * @param orderIndex - Order index
   * @returns Transaction request
   */
  async buildOrderCancelTx(
    pairIndex: number,
    orderIndex: number
  ): Promise<TransactionRequest> {
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('cancelOpenOrder', [
        pairIndex,
        orderIndex,
      ]),
    };
  }

  /**
   * Build transaction to update trade margin
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @param marginDelta - Margin change amount (USDC)
   * @param updateType - Deposit or withdraw
   * @returns Transaction request
   */
  async buildTradeMarginUpdateTx(
    pairIndex: number,
    tradeIndex: number,
    marginDelta: number,
    updateType: MarginUpdateType
  ): Promise<TransactionRequest> {
    const isDeposit = updateType === MarginUpdateType.DEPOSIT;

    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('updateMargin', [
        pairIndex,
        tradeIndex,
        toBlockchain6(marginDelta),
        isDeposit,
      ]),
    };
  }

  /**
   * Build transaction to update take profit and stop loss
   * @param pairIndex - Pair index
   * @param tradeIndex - Trade index
   * @param tp - Take profit price
   * @param sl - Stop loss price
   * @returns Transaction request
   */
  async buildTradeTpSlUpdateTx(
    pairIndex: number,
    tradeIndex: number,
    tp: number,
    sl: number
  ): Promise<TransactionRequest> {
    return {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('updateTpSl', [
        pairIndex,
        tradeIndex,
        toBlockchain10(tp),
        toBlockchain10(sl),
      ]),
    };
  }

  /**
   * Get trade execution fee
   * @returns Execution fee in native token (wei)
   */
  async getTradeExecutionFee(): Promise<bigint> {
    try {
      return await this.tradingContract.getExecutionFee();
    } catch (error) {
      console.error('Error getting execution fee:', error);
      return BigInt(0);
    }
  }

  /**
   * Get all trades for a trader
   * @param traderAddress - Trader address
   * @param maxPairs - Maximum pair indices to check (default: 100)
   * @returns Array of trades
   */
  async getTrades(traderAddress: string, maxPairs: number = 100): Promise<TradeResponse[]> {
    try {
      const trades: TradeResponse[] = [];

      // Check pairs concurrently for better performance
      const pairPromises: Promise<void>[] = [];

      for (let pairIndex = 0; pairIndex < maxPairs; pairIndex++) {
        const pairPromise = (async () => {
          try {
            // Get the count of trades for this trader on this pair
            const count = await this.tradingStorageContract.openTradesCount(traderAddress, pairIndex);

            if (count === 0n || count === 0) return;

            // Fetch all trades for this pair
            const tradePromises = [];
            for (let index = 0; index < Number(count); index++) {
              tradePromises.push(
                this.tradingStorageContract.openTrades(traderAddress, pairIndex, index)
                  .then((trade) => {
                    // Only add if the trade exists (leverage > 0)
                    if (trade.leverage > 0) {
                      trades.push({
                        trader: trade.trader,
                        pairIndex: Number(trade.pairIndex),
                        index: Number(trade.index),
                        initialPosUsdc: fromBlockchain6(trade.initialPosToken || trade.positionSizeUSDC),
                        openPrice: fromBlockchain10(trade.openPrice),
                        buy: trade.buy,
                        leverage: Number(fromBlockchain10(trade.leverage)),
                        tp: fromBlockchain10(trade.tp),
                        sl: fromBlockchain10(trade.sl),
                      });
                    }
                  })
                  .catch(() => {
                    // Skip if trade doesn't exist at this index
                  })
              );
            }
            await Promise.all(tradePromises);
          } catch (err) {
            // Skip if no trades for this pair
          }
        })();

        pairPromises.push(pairPromise);
      }

      await Promise.all(pairPromises);
      return trades;
    } catch (error) {
      console.error('Error getting trades:', error);
      return [];
    }
  }

  /**
   * Convert order type string to numeric value
   * @param orderType - Order type string
   * @returns Numeric order type
   */
  private getOrderTypeValue(orderType: string): number {
    const orderTypes: Record<string, number> = {
      market: 0,
      limit: 1,
      stop_limit: 2,
      market_zero_fee: 3,
    };
    return orderTypes[orderType] || 0;
  }
}
