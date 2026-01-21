import { Contract, TransactionReceipt, TransactionRequest } from 'ethers';
import { ethers } from 'ethers';
import { ReferralTier, ReferralDiscount } from '../types';
import { BaseSigner } from '../signers/base';

/**
 * Referral Operations RPC
 * Handles referral program functionality including codes, tiers, and discounts
 */
export class ReferralOperationsRPC {
  constructor(
    private referralContract: Contract,
    private signer?: BaseSigner
  ) {}

  /**
   * Get referral information for a trader
   * @param account - Trader address
   * @returns Referral code and referrer address
   */
  async getTraderReferralInfo(account: string): Promise<{ code: string; referrer: string }> {
    const [code, referrer] = await this.referralContract.getTraderReferralInfo(account);

    return {
      code: ethers.decodeBytes32String(code),
      referrer,
    };
  }

  /**
   * Get referrer tier
   * @param account - Referrer address
   * @returns Tier ID
   */
  async getReferrerTier(account: string): Promise<number> {
    const tier = await this.referralContract.referrerTiers(account);
    return Number(tier);
  }

  /**
   * Get tier information
   * @param tierId - Tier ID
   * @returns Tier information with fee discount and rebate percentages
   */
  async getTierInfo(tierId: number): Promise<ReferralTier> {
    const tier = await this.referralContract.tiers(tierId);

    return {
      feeDiscountPct: Number(tier.feeDiscountPct),
      refRebatePct: Number(tier.refRebatePct),
    };
  }

  /**
   * Calculate referral discount for a trader and fee
   * @param account - Trader address
   * @param fee - Original fee amount
   * @returns Discount information
   */
  async getTraderReferralDiscount(account: string, fee: number): Promise<ReferralDiscount> {
    const result = await this.referralContract.traderReferralDiscount(account, fee);

    return {
      traderDiscount: Number(result.traderDiscount),
      referrer: result.referrer,
      rebateShare: Number(result.rebateShare),
    };
  }

  /**
   * Set referral code for the caller
   * @param code - Referral code (max 32 characters)
   * @returns Transaction receipt
   */
  async setReferralCode(code: string): Promise<TransactionReceipt | null> {
    if (!this.signer) {
      throw new Error('Signer required for setting referral code');
    }

    // Convert string to bytes32
    const codeBytes32 = ethers.encodeBytes32String(code);

    const tx: TransactionRequest = {
      to: await this.referralContract.getAddress(),
      data: this.referralContract.interface.encodeFunctionData('setTraderReferralCodeByUser', [
        codeBytes32,
      ]),
    };

    return await this.signAndSend(tx);
  }

  /**
   * Check if an account has a referral code set
   * @param account - Trader address
   * @returns True if referral code is set
   */
  async hasReferralCode(account: string): Promise<boolean> {
    const { code } = await this.getTraderReferralInfo(account);
    return code !== '' && code !== '\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00';
  }

  /**
   * Get effective fee after referral discount
   * @param account - Trader address
   * @param baseFee - Base fee amount
   * @returns Effective fee after discount
   */
  async getEffectiveFee(account: string, baseFee: number): Promise<number> {
    const discount = await this.getTraderReferralDiscount(account, baseFee);
    return baseFee - discount.traderDiscount;
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

    const provider = this.referralContract.runner?.provider;
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
