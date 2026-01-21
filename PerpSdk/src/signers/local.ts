import { Wallet, Provider, TransactionRequest } from 'ethers';
import { BaseSigner } from './base';

/**
 * Local signer using a private key stored in memory
 * WARNING: Use with caution in production environments
 */
export class LocalSigner extends BaseSigner {
  private wallet: Wallet;

  /**
   * Create a local signer from a private key
   * @param privateKey - Private key (with or without 0x prefix)
   * @param provider - Ethereum provider
   */
  constructor(privateKey: string, provider: Provider) {
    super();

    // Ensure private key has 0x prefix
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }

    this.wallet = new Wallet(privateKey, provider);
  }

  /**
   * Sign a transaction using the private key
   * @param transaction - Transaction to sign
   * @returns Signed transaction as hex string
   */
  async signTransaction(transaction: TransactionRequest): Promise<string> {
    return await this.wallet.signTransaction(transaction);
  }

  /**
   * Get the Ethereum address for this signer
   * @returns Ethereum address
   */
  async getAddress(): Promise<string> {
    return this.wallet.address;
  }

  /**
   * Sign a message using the private key
   * @param message - Message to sign
   * @returns Signature
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    return await this.wallet.signMessage(message);
  }

  /**
   * Get the wallet instance (for advanced usage)
   * @returns Wallet instance
   */
  getWallet(): Wallet {
    return this.wallet;
  }

  /**
   * Create a random wallet
   * @param provider - Ethereum provider
   * @returns LocalSigner with random wallet
   */
  static createRandom(provider: Provider): LocalSigner {
    const wallet = Wallet.createRandom();
    return new LocalSigner(wallet.privateKey, provider);
  }
}
