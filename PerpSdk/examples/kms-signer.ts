/**
 * Example using AWS KMS for secure transaction signing
 */

import { TraderClient } from '../src';

async function main() {
  // Initialize client
  const providerUrl = 'https://your-rpc-endpoint.com';
  const client = new TraderClient(providerUrl);

  // Set up AWS KMS signer
  const kmsKeyId = 'your-kms-key-id';
  const region = 'us-east-1';
  client.setAwsKmsSigner(kmsKeyId, region);

  // Get address from KMS key
  const address = await client.signer?.getAddress();
  console.log('Trading from KMS-secured address:', address);

  // Now you can use the client normally
  // All transactions will be signed by AWS KMS
  const balance = await client.getUsdcBalance(address!);
  console.log('USDC Balance:', balance);

  // The private key never leaves AWS KMS hardware security modules
  console.log('Secure signing enabled via AWS KMS');
}

// Run the example
main().catch(console.error);
