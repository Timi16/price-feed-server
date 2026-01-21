import { TransactionRequest, TransactionResponse } from 'ethers';

/**
 * Abstract base class for transaction signers
 * Implementations can use local private keys, AWS KMS, or other signing methods
 */
export abstract class BaseSigner {
  /**
   * Sign a transaction
   * @param transaction - Transaction to sign
   * @returns Signed transaction
   */
  abstract signTransaction(transaction: TransactionRequest): Promise<string>;

  /**
   * Get the Ethereum address associated with this signer
   * @returns Ethereum address
   */
  abstract getAddress(): Promise<string>;

  /**
   * Sign a message
   * @param message - Message to sign
   * @returns Signature
   */
  abstract signMessage(message: string | Uint8Array): Promise<string>;
}
