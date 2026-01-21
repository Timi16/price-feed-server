/**
 * Delegation and Referrals Example
 * Demonstrates delegation functionality and referral program
 */

import { TraderClient, toBlockchain10, toBlockchain6, toBlockchain18 } from '../src';

async function main() {
  // Initialize client
  const client = new TraderClient('https://mainnet.base.org');
  const privateKey = process.env.PRIVATE_KEY || '0x...';
  client.setLocalSigner(privateKey);

  const walletAddress = await client.signer?.getAddress();
  console.log('Wallet address:', walletAddress);

  // ==================== DELEGATION ====================

  console.log('\n=== DELEGATION ===\n');

  // 1. Set a delegate
  console.log('1. Setting delegate...');
  const delegateAddress = '0x...'; // Replace with actual delegate address

  try {
    const receipt = await client.delegation.setDelegate(delegateAddress);
    console.log('Delegate set! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error setting delegate:', error);
  }

  // 2. Check current delegate
  console.log('\n2. Checking current delegate...');
  const currentDelegate = await client.delegation.getDelegateFor(walletAddress!);
  console.log('Current delegate:', currentDelegate);

  // 3. Execute delegated action (as delegate)
  console.log('\n3. Executing delegated action...');

  // Example: Update TP/SL as delegate
  const traderAddress = '0x...'; // Address you're delegating for
  const newSl = toBlockchain10(47000);
  const newTp = toBlockchain10(56000);

  const callData = client.delegation.encodeUpdateTpAndSl(
    0, // pairIndex
    0, // tradeIndex
    newSl,
    newTp,
    []
  );

  try {
    const receipt = await client.delegation.delegatedAction(
      traderAddress,
      callData,
      1n // 1 wei for price update
    );

    console.log('Delegated action executed! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error executing delegated action:', error);
  }

  // 4. Remove delegate
  console.log('\n4. Removing delegate...');

  try {
    const receipt = await client.delegation.removeDelegate();
    console.log('Delegate removed! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error removing delegate:', error);
  }

  // ==================== REFERRALS ====================

  console.log('\n=== REFERRALS ===\n');

  // 1. Set referral code
  console.log('1. Setting referral code...');

  try {
    const receipt = await client.referral.setReferralCode('AVANTIS2024');
    console.log('Referral code set! Transaction hash:', receipt?.hash);
  } catch (error) {
    console.error('Error setting referral code:', error);
  }

  // 2. Get referral info
  console.log('\n2. Getting referral info...');
  const referralInfo = await client.referral.getTraderReferralInfo(walletAddress!);
  console.log('Referral code:', referralInfo.code);
  console.log('Referrer address:', referralInfo.referrer);

  // 3. Check if user has referral code
  const hasCode = await client.referral.hasReferralCode(walletAddress!);
  console.log('Has referral code:', hasCode);

  // 4. Get referrer tier
  if (referralInfo.referrer !== '0x0000000000000000000000000000000000000000') {
    const tier = await client.referral.getReferrerTier(referralInfo.referrer);
    console.log('Referrer tier:', tier);

    // Get tier details
    const tierInfo = await client.referral.getTierInfo(tier);
    console.log('Tier info:', {
      feeDiscountPct: tierInfo.feeDiscountPct,
      refRebatePct: tierInfo.refRebatePct,
    });
  }

  // 5. Calculate referral discount
  console.log('\n5. Calculating referral discount...');
  const baseFee = 1000000; // 1 USDC in 6 decimals
  const discount = await client.referral.getTraderReferralDiscount(walletAddress!, baseFee);

  console.log('Discount info:', {
    traderDiscount: discount.traderDiscount,
    referrer: discount.referrer,
    rebateShare: discount.rebateShare,
  });

  // 6. Get effective fee after discount
  const effectiveFee = await client.referral.getEffectiveFee(walletAddress!, baseFee);
  console.log('Original fee:', baseFee);
  console.log('Effective fee after discount:', effectiveFee);
}

// Run the example
main().catch(console.error);
