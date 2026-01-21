import { Contract, TransactionReceipt, TransactionRequest } from 'ethers';
import {
  Trade,
  TradeInfo,
  OpenLimitOrder,
  TradeInputOrderType,
  MarginUpdateType,
  toBlockchain6,
  toBlockchain10,
  toBlockchain18,
  fromBlockchain6,
  fromBlockchain10,
  fromBlockchain18,
} from '../types';
import { BaseSigner } from '../signers/base';

/**
 * Trading Operations RPC
 * Handles all trading contract interactions including opening/closing trades,
 * updating margins, and managing limit orders.
 */
export class TradingOperationsRPC {
  constructor(
    private tradingContract: Contract,
    private tradingStorageContract: Contract,
    private signer?: BaseSigner
  ) {}

  /**
   * Get execution fee required for trading operations
   * @returns Execution fee in ETH
   */
  async getExecutionFee(): Promise<number> {
    const fee = await this.tradingContract.getExecutionFee();
    return fromBlockchain18(fee);
  }

  /**
   * Open a new trade position
   * @param trade - Trade parameters
   * @param orderType - Order type (MARKET, LIMIT, etc.)
   * @param slippageP - Slippage percentage (e.g., 1 for 1%)
   * @param executionFeeEth - Execution fee in ETH (optional, will fetch if not provided)
   * @returns Transaction receipt
   */
  async openTrade(
    trade: Omit<Trade, 'timestamp'>,
    orderType: TradeInputOrderType,
    slippageP: number,
    executionFeeEth?: number
  ): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for trading operations');
    }

    // Get execution fee if not provided
    if (!executionFeeEth) {
      executionFeeEth = await this.getExecutionFee();
    }

    // Convert order type to number
    const orderTypeMap: Record<TradeInputOrderType, number> = {
      [TradeInputOrderType.MARKET]: 0,
      [TradeInputOrderType.STOP_LIMIT]: 1,
      [TradeInputOrderType.LIMIT]: 2,
      [TradeInputOrderType.MARKET_ZERO_FEE]: 3,
    };

    // Prepare trade struct with blockchain values
    const tradeStruct = {
      trader: trade.trader,
      pairIndex: trade.pairIndex,
      index: trade.index,
      initialPosToken: toBlockchain6(trade.initialPosToken),
      positionSizeUSDC: toBlockchain6(trade.positionSizeUSDC),
      openPrice: toBlockchain10(trade.openPrice),
      buy: trade.buy,
      leverage: toBlockchain10(trade.leverage),
      tp: toBlockchain10(trade.tp),
      sl: toBlockchain10(trade.sl),
      timestamp: Math.floor(Date.now() / 1000),
    };

    const slippageBlockchain = toBlockchain10(slippageP);
    const executionFeeWei = toBlockchain18(executionFeeEth);

    // Create transaction
    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('openTrade', [
        tradeStruct,
        orderTypeMap[orderType],
        slippageBlockchain,
      ]),
      value: executionFeeWei,
    };

    return await this.signAndSend(tx);
  }

  /**
   * Close a trade position at market price
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @param closeAmount - Amount of collateral to close (USDC)
   * @param executionFeeEth - Execution fee in ETH (optional)
   * @returns Transaction receipt
   */
  async closeTradeMarket(
    pairIndex: number,
    index: number,
    closeAmount: number,
    executionFeeEth?: number
  ): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for trading operations');
    }

    if (!executionFeeEth) {
      executionFeeEth = await this.getExecutionFee();
    }

    const closeAmountBlockchain = toBlockchain6(closeAmount);
    const executionFeeWei = toBlockchain18(executionFeeEth);

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('closeTradeMarket', [
        pairIndex,
        index,
        closeAmountBlockchain,
      ]),
      value: executionFeeWei,
    };

    return await this.signAndSend(tx);
  }

  /**
   * Update margin for an existing trade
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @param updateType - DEPOSIT or WITHDRAW
   * @param amount - Amount to add/remove (USDC)
   * @param priceUpdateData - Price oracle update data
   * @returns Transaction receipt
   */
  async updateMargin(
    pairIndex: number,
    index: number,
    updateType: MarginUpdateType,
    amount: number,
    priceUpdateData: string[] = []
  ): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for trading operations');
    }

    const amountBlockchain = toBlockchain6(amount);

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('updateMargin', [
        pairIndex,
        index,
        updateType,
        amountBlockchain,
        priceUpdateData,
      ]),
      value: 1n, // 1 wei for price update
    };

    return await this.signAndSend(tx);
  }

  /**
   * Update take profit and stop loss for a trade
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @param newSl - New stop loss price
   * @param newTp - New take profit price
   * @param priceUpdateData - Price oracle update data
   * @returns Transaction receipt
   */
  async updateTpAndSl(
    pairIndex: number,
    index: number,
    newSl: number,
    newTp: number,
    priceUpdateData: string[] = []
  ): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for trading operations');
    }

    const slBlockchain = toBlockchain10(newSl);
    const tpBlockchain = toBlockchain10(newTp);

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('updateTpAndSl', [
        pairIndex,
        index,
        slBlockchain,
        tpBlockchain,
        priceUpdateData,
      ]),
      value: 1n, // 1 wei for price update
    };

    return await this.signAndSend(tx);
  }

  /**
   * Cancel a pending limit order
   * @param pairIndex - Trading pair index
   * @param index - Order index
   * @returns Transaction receipt
   */
  async cancelOpenLimitOrder(
    pairIndex: number,
    index: number
  ): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for trading operations');
    }

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('cancelOpenLimitOrder', [
        pairIndex,
        index,
      ]),
    };

    return await this.signAndSend(tx);
  }

  /**
   * Get open trade information
   * @param trader - Trader address
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @returns Trade information
   */
  async getOpenTrade(trader: string, pairIndex: number, index: number): Promise<Trade> {
    const result = await this.tradingStorageContract.openTrades(trader, pairIndex, index);

    return {
      trader: result.trader,
      pairIndex: Number(result.pairIndex),
      index: Number(result.index),
      initialPosToken: fromBlockchain6(result.initialPosToken),
      positionSizeUSDC: fromBlockchain6(result.positionSizeUSDC),
      openPrice: fromBlockchain10(result.openPrice),
      buy: result.buy,
      leverage: fromBlockchain10(result.leverage),
      tp: fromBlockchain10(result.tp),
      sl: fromBlockchain10(result.sl),
      timestamp: Number(result.timestamp),
    };
  }

  /**
   * Get additional trade information
   * @param trader - Trader address
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @returns Trade info
   */
  async getOpenTradeInfo(
    trader: string,
    pairIndex: number,
    index: number
  ): Promise<TradeInfo> {
    const result = await this.tradingStorageContract.openTradesInfo(trader, pairIndex, index);

    return {
      openInterestUSDC: fromBlockchain6(result.openInterestUSDC),
      tpLastUpdated: Number(result.tpLastUpdated),
      slLastUpdated: Number(result.slLastUpdated),
      beingMarketClosed: result.beingMarketClosed,
      lossProtection: Number(result.lossProtection),
    };
  }

  /**
   * Get number of open trades for a trader on a pair
   * @param trader - Trader address
   * @param pairIndex - Trading pair index
   * @returns Number of open trades
   */
  async getOpenTradesCount(trader: string, pairIndex: number): Promise<number> {
    const count = await this.tradingStorageContract.openTradesCount(trader, pairIndex);
    return Number(count);
  }

  /**
   * Get limit order information
   * @param trader - Trader address
   * @param pairIndex - Trading pair index
   * @param index - Order index
   * @returns Limit order information
   */
  async getOpenLimitOrder(
    trader: string,
    pairIndex: number,
    index: number
  ): Promise<OpenLimitOrder> {
    const result = await this.tradingStorageContract.getOpenLimitOrder(trader, pairIndex, index);

    return {
      trader: result.trader,
      pairIndex: Number(result.pairIndex),
      index: Number(result.index),
      positionSize: fromBlockchain6(result.positionSize),
      buy: result.buy,
      leverage: fromBlockchain10(result.leverage),
      tp: fromBlockchain10(result.tp),
      sl: fromBlockchain10(result.sl),
      price: fromBlockchain10(result.price),
      slippageP: fromBlockchain10(result.slippageP),
      block: Number(result.block),
      executionFee: fromBlockchain18(result.executionFee),
    };
  }

  /**
   * Helper method to sign and send transactions
   */
  private async signAndSend(tx: TransactionRequest): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer not set');
    }

    const address = await this.signer.getAddress();
    tx.from = address;

    const provider = this.tradingContract.runner?.provider;
    if (!provider) {
      throw new Error('Provider not available');
    }

    if (!tx.chainId) {
      const network = await provider.getNetwork();
      tx.chainId = network.chainId;
    }

    if (tx.nonce === undefined) {
      tx.nonce = await provider.getTransactionCount(address);
    }

    if (!tx.gasLimit) {
      tx.gasLimit = await provider.estimateGas(tx);
    }

    if (!tx.maxFeePerGas && !tx.gasPrice) {
      const feeData = await provider.getFeeData();
      if (feeData.maxFeePerGas) {
        tx.maxFeePerGas = feeData.maxFeePerGas;
        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas;
      } else {
        tx.gasPrice = feeData.gasPrice || undefined;
      }
    }

    const signedTx = await this.signer.signTransaction(tx);
    const txResponse = await provider.broadcastTransaction(signedTx);
    return await txResponse.wait();
  }

  /**
   * Set signer for transactions
   */
  setSigner(signer: BaseSigner): void {
    this.signer = signer;
  }
}
