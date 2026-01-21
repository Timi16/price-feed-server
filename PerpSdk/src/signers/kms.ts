import { KMSClient, GetPublicKeyCommand, SignCommand } from '@aws-sdk/client-kms';
import { Provider, TransactionRequest, keccak256, getBytes, Transaction, resolveAddress } from 'ethers';
import { BaseSigner } from './base';
import {
  derEncodedPublicKeyToEthAddress,
  getSigRSV,
  signatureToHex,
} from '../crypto/spki';

/**
 * AWS KMS signer for secure transaction signing without exposing private keys
 * Private key never leaves AWS KMS hardware security modules
 */
export class KMSSigner extends BaseSigner {
  private kmsClient: KMSClient;
  private kmsKeyId: string;
  private provider: Provider;
  private addressCache?: string;

  /**
   * Create a KMS signer
   * @param kmsKeyId - AWS KMS key ID
   * @param provider - Ethereum provider
   * @param region - AWS region (default: us-east-1)
   */
  constructor(kmsKeyId: string, provider: Provider, region: string = 'us-east-1') {
    super();
    this.kmsKeyId = kmsKeyId;
    this.provider = provider;
    this.kmsClient = new KMSClient({ region });
  }

  /**
   * Get the public key from KMS
   * @returns DER-encoded public key
   */
  private async getPublicKey(): Promise<Uint8Array> {
    const command = new GetPublicKeyCommand({
      KeyId: this.kmsKeyId,
    });

    const response = await this.kmsClient.send(command);

    if (!response.PublicKey) {
      throw new Error('Failed to get public key from KMS');
    }

    return response.PublicKey;
  }

  /**
   * Get the Ethereum address derived from the KMS key
   * @returns Ethereum address
   */
  async getAddress(): Promise<string> {
    if (this.addressCache) {
      return this.addressCache;
    }

    const publicKey = await this.getPublicKey();
    this.addressCache = derEncodedPublicKeyToEthAddress(publicKey);
    return this.addressCache;
  }

  /**
   * Sign a message hash using KMS
   * @param msgHash - Message hash to sign
   * @returns DER-encoded signature
   */
  private async signMsgHash(msgHash: Uint8Array): Promise<Uint8Array> {
    const command = new SignCommand({
      KeyId: this.kmsKeyId,
      Message: msgHash,
      MessageType: 'DIGEST',
      SigningAlgorithm: 'ECDSA_SHA_256',
    });

    const response = await this.kmsClient.send(command);

    if (!response.Signature) {
      throw new Error('Failed to sign message with KMS');
    }

    return response.Signature;
  }

  /**
   * Sign a transaction using KMS
   * @param transaction - Transaction to sign
   * @returns Signed transaction as hex string
   */
  async signTransaction(transaction: TransactionRequest): Promise<string> {
    // Get the address to fill in the 'from' field if not set
    const address = await this.getAddress();

    // Fill in missing fields
    const tx: TransactionRequest = {
      ...transaction,
      from: address,
    };

    // Get chain ID if not provided
    if (!tx.chainId) {
      const network = await this.provider.getNetwork();
      tx.chainId = network.chainId;
    }

    // Get nonce if not provided
    if (tx.nonce === undefined) {
      tx.nonce = await this.provider.getTransactionCount(address);
    }

    // Estimate gas if not provided
    if (!tx.gasLimit) {
      tx.gasLimit = await this.provider.estimateGas(tx);
    }

    // Get gas price if not provided (for legacy transactions)
    if (!tx.maxFeePerGas && !tx.gasPrice) {
      const feeData = await this.provider.getFeeData();
      if (feeData.maxFeePerGas) {
        tx.maxFeePerGas = feeData.maxFeePerGas;
        tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas;
      } else {
        tx.gasPrice = feeData.gasPrice || undefined;
      }
    }

    // Resolve address fields to strings
    const resolvedTo = tx.to ? await resolveAddress(tx.to, this.provider) : null;
    const resolvedFrom = tx.from ? await resolveAddress(tx.from, this.provider) : address;

    // Create a transaction object with resolved fields
    const resolvedTx = {
      type: tx.type,
      to: resolvedTo,
      from: resolvedFrom,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      data: tx.data,
      value: tx.value,
      chainId: tx.chainId,
      accessList: tx.accessList,
    };

    // Create unsigned transaction
    const unsignedTx = Transaction.from(resolvedTx);
    const unsignedSerialized = unsignedTx.unsignedSerialized;

    // Hash the unsigned transaction
    const msgHash = keccak256(unsignedSerialized);
    const msgHashBytes = getBytes(msgHash);

    // Sign with KMS
    const kmsSignature = await this.signMsgHash(msgHashBytes);

    // Parse signature and recover v
    const { r, s, v } = getSigRSV(kmsSignature, msgHash, address);

    // Create signed transaction
    unsignedTx.signature = { r, s, v };

    return unsignedTx.serialized;
  }

  /**
   * Sign a message using KMS
   * @param message - Message to sign
   * @returns Signature as hex string
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    const address = await this.getAddress();

    // Convert message to bytes
    const messageBytes =
      typeof message === 'string' ? Buffer.from(message, 'utf8') : message;

    // Create Ethereum signed message hash
    const messageHash = keccak256(
      concat([
        Buffer.from('\x19Ethereum Signed Message:\n', 'utf8'),
        Buffer.from(String(messageBytes.length), 'utf8'),
        messageBytes,
      ])
    );

    const msgHashBytes = getBytes(messageHash);

    // Sign with KMS
    const kmsSignature = await this.signMsgHash(msgHashBytes);

    // Parse signature and recover v
    const { r, s, v } = getSigRSV(kmsSignature, messageHash, address);

    return signatureToHex(r, s, v);
  }
}

// Helper function for concat
function concat(arrays: (Uint8Array | Buffer)[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
