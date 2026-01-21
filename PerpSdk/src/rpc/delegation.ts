import { Contract, TransactionReceipt, TransactionRequest } from 'ethers';
import { BaseSigner } from '../signers/base';

/**
 * Delegation RPC
 * Handles delegation functionality for the Trading contract.
 * Allows one address to execute trades on behalf of another.
 */
export class DelegationRPC {
  constructor(
    private tradingContract: Contract,
    private signer?: BaseSigner
  ) {}

  /**
   * Set a delegate wallet that can perform trade actions on behalf of caller
   * @param delegate - Address to authorize as delegate (use 0x0 to revoke)
   * @returns Transaction receipt
   */
  async setDelegate(delegate: string): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for delegation operations');
    }

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('setDelegate', [delegate]),
    };

    return await this.signAndSend(tx);
  }

  /**
   * Remove the current delegate for the caller
   * @returns Transaction receipt
   */
  async removeDelegate(): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for delegation operations');
    }

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('removeDelegate'),
    };

    return await this.signAndSend(tx);
  }

  /**
   * Get the delegate wallet for a given owner
   * @param owner - Owner address to check
   * @returns Delegate address (0x0 if none set)
   */
  async getDelegateFor(owner: string): Promise<string> {
    return await this.tradingContract.delegations(owner);
  }

  /**
   * Execute a delegated action on behalf of a trader
   * @param trader - Address of the trader to act on behalf of
   * @param callData - ABI-encoded function data for the action
   * @param value - ETH value to send (for execution fees)
   * @returns Transaction receipt
   */
  async delegatedAction(
    trader: string,
    callData: string,
    value: bigint = 0n
  ): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for delegation operations');
    }

    const tx: TransactionRequest = {
      to: await this.tradingContract.getAddress(),
      data: this.tradingContract.interface.encodeFunctionData('delegatedAction', [
        trader,
        callData,
      ]),
      value,
    };

    return await this.signAndSend(tx);
  }

  /**
   * Helper: Create call data for openTrade to be used with delegatedAction
   * @param tradeStruct - Trade struct with blockchain values
   * @param orderType - Order type (0-3)
   * @param slippageP - Slippage percentage in blockchain units
   * @returns Encoded call data
   */
  encodeOpenTrade(
    tradeStruct: any,
    orderType: number,
    slippageP: bigint
  ): string {
    return this.tradingContract.interface.encodeFunctionData('openTrade', [
      tradeStruct,
      orderType,
      slippageP,
    ]);
  }

  /**
   * Helper: Create call data for closeTradeMarket to be used with delegatedAction
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @param amount - Amount to close in blockchain units
   * @returns Encoded call data
   */
  encodeCloseTradeMarket(
    pairIndex: number,
    index: number,
    amount: bigint
  ): string {
    return this.tradingContract.interface.encodeFunctionData('closeTradeMarket', [
      pairIndex,
      index,
      amount,
    ]);
  }

  /**
   * Helper: Create call data for updateTpAndSl to be used with delegatedAction
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @param newSl - New stop loss in blockchain units
   * @param newTp - New take profit in blockchain units
   * @param priceUpdateData - Price update data
   * @returns Encoded call data
   */
  encodeUpdateTpAndSl(
    pairIndex: number,
    index: number,
    newSl: bigint,
    newTp: bigint,
    priceUpdateData: string[]
  ): string {
    return this.tradingContract.interface.encodeFunctionData('updateTpAndSl', [
      pairIndex,
      index,
      newSl,
      newTp,
      priceUpdateData,
    ]);
  }

  /**
   * Helper: Create call data for updateMargin to be used with delegatedAction
   * @param pairIndex - Trading pair index
   * @param index - Trade index
   * @param updateType - 0 for DEPOSIT, 1 for WITHDRAW
   * @param amount - Amount in blockchain units
   * @param priceUpdateData - Price update data
   * @returns Encoded call data
   */
  encodeUpdateMargin(
    pairIndex: number,
    index: number,
    updateType: number,
    amount: bigint,
    priceUpdateData: string[]
  ): string {
    return this.tradingContract.interface.encodeFunctionData('updateMargin', [
      pairIndex,
      index,
      updateType,
      amount,
      priceUpdateData,
    ]);
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
