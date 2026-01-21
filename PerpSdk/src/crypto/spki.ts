import { keccak256, getBytes, concat, SigningKey } from 'ethers';

/**
 * Cryptographic utilities for KMS signature handling
 * Handles ECDSA signature conversion and Ethereum address derivation
 */

/**
 * Convert a public key (as big integer coordinates) to an Ethereum address
 * @param publicKeyX - X coordinate of public key
 * @param publicKeyY - Y coordinate of public key
 * @returns Ethereum address
 */
export function publicKeyIntToEthAddress(publicKeyX: bigint, publicKeyY: bigint): string {
  // Concatenate 0x04 (uncompressed key prefix) + x + y
  const xBytes = publicKeyX.toString(16).padStart(64, '0');
  const yBytes = publicKeyY.toString(16).padStart(64, '0');
  const publicKeyHex = '0x04' + xBytes + yBytes;

  // Keccak256 hash
  const hash = keccak256(publicKeyHex);

  // Take last 20 bytes as address
  return '0x' + hash.slice(-40);
}

/**
 * Parse DER-encoded public key and convert to Ethereum address
 * @param derPublicKey - DER-encoded public key bytes
 * @returns Ethereum address
 */
export function derEncodedPublicKeyToEthAddress(derPublicKey: Uint8Array): string {
  // Parse the DER structure to extract the public key
  // DER structure for ECDSA public key (simplified parsing)

  // Find the public key bytes (starts with 0x04 for uncompressed key)
  let publicKeyStart = -1;
  for (let i = 0; i < derPublicKey.length - 64; i++) {
    if (derPublicKey[i] === 0x04) {
      publicKeyStart = i;
      break;
    }
  }

  if (publicKeyStart === -1) {
    throw new Error('Could not find uncompressed public key in DER structure');
  }

  // Extract 65 bytes: 0x04 + 32 bytes X + 32 bytes Y
  const publicKeyBytes = derPublicKey.slice(publicKeyStart, publicKeyStart + 65);

  // Convert to hex
  const publicKeyHex = '0x' + Buffer.from(publicKeyBytes).toString('hex');

  // Keccak256 hash (skip the 0x04 prefix)
  const hash = keccak256(publicKeyHex);

  // Take last 20 bytes as address
  return '0x' + hash.slice(-40);
}

/**
 * Parse DER-encoded signature to extract r and s values
 * @param derSignature - DER-encoded signature
 * @returns Object with r and s as hex strings
 */
export function getSigRS(derSignature: Uint8Array): { r: string; s: string } {
  // DER signature structure:
  // 0x30 [total-length] 0x02 [r-length] [r-bytes] 0x02 [s-length] [s-bytes]

  let offset = 0;

  // Check sequence tag
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: missing sequence tag');
  }

  // Skip total length
  offset++;

  // Read r
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing r integer tag');
  }

  const rLength = derSignature[offset++];
  let rBytes = derSignature.slice(offset, offset + rLength);
  offset += rLength;

  // Remove leading zero if present (DER encoding adds it for positive numbers)
  if (rBytes[0] === 0x00) {
    rBytes = rBytes.slice(1);
  }

  const r = '0x' + Buffer.from(rBytes).toString('hex');

  // Read s
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing s integer tag');
  }

  const sLength = derSignature[offset++];
  let sBytes = derSignature.slice(offset, offset + sLength);

  // Remove leading zero if present
  if (sBytes[0] === 0x00) {
    sBytes = sBytes.slice(1);
  }

  const s = '0x' + Buffer.from(sBytes).toString('hex');

  return { r, s };
}

/**
 * Recover the v value for an ECDSA signature
 * @param msgHash - Message hash that was signed
 * @param r - r component of signature
 * @param s - s component of signature
 * @param expectedAddress - Expected Ethereum address
 * @returns v value (27 or 28)
 */
export function getSigV(
  msgHash: string,
  r: string,
  s: string,
  expectedAddress: string
): number {
  // Try both possible v values (27 and 28)
  for (const v of [27, 28]) {
    try {
      const signature = {
        r,
        s,
        v,
      };

      // Construct the signature string
      const sigString = concat([
        signature.r,
        signature.s,
        new Uint8Array([signature.v]),
      ]);

      // Try to recover the address
      const recoveredAddress = SigningKey.recoverPublicKey(
        getBytes(msgHash),
        sigString
      );

      const recoveredAddr = keccak256('0x' + recoveredAddress.slice(4));
      const addr = '0x' + recoveredAddr.slice(-40);

      if (addr.toLowerCase() === expectedAddress.toLowerCase()) {
        return v;
      }
    } catch (e) {
      // Continue to next v value
      continue;
    }
  }

  throw new Error('Could not recover v value from signature');
}

/**
 * Get complete signature (r, s, v) from DER-encoded KMS signature
 * @param kmsSignature - DER-encoded signature from KMS
 * @param msgHash - Message hash that was signed
 * @param ethAddress - Expected Ethereum address
 * @returns Complete signature object
 */
export function getSigRSV(
  kmsSignature: Uint8Array,
  msgHash: string,
  ethAddress: string
): { r: string; s: string; v: number } {
  const { r, s } = getSigRS(kmsSignature);
  const v = getSigV(msgHash, r, s, ethAddress);

  return { r, s, v };
}

/**
 * Convert signature components to a single hex string
 * @param r - r component
 * @param s - s component
 * @param v - v component
 * @returns Signature as hex string
 */
export function signatureToHex(r: string, s: string, v: number): string {
  const rHex = r.startsWith('0x') ? r.slice(2) : r;
  const sHex = s.startsWith('0x') ? s.slice(2) : s;
  const vHex = v.toString(16).padStart(2, '0');

  return '0x' + rHex.padStart(64, '0') + sHex.padStart(64, '0') + vHex;
}
