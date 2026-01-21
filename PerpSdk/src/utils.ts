import { Interface, Result } from 'ethers';

/**
 * Utility functions for Web3 decoding and data processing
 */

/**
 * Check if ABI type is a tuple
 */
export function isTupleType(abiType: string): boolean {
  return abiType.startsWith('tuple');
}

/**
 * Check if ABI type is an array
 */
export function isArrayType(abiType: string): boolean {
  return abiType.endsWith('[]');
}

/**
 * Process ABI outputs and convert Result to object with named fields
 */
export function processOutputTypes(
  outputs: readonly any[],
  decoded: Result
): Record<string, any> {
  const result: Record<string, any> = {};

  outputs.forEach((output, index) => {
    const name = output.name || `output${index}`;
    let value = decoded[index];

    // Handle tuple types
    if (isTupleType(output.type) && output.components) {
      value = processOutputTypes(output.components, value as Result);
    }
    // Handle array of tuples
    else if (isArrayType(output.type) && output.baseType === 'tuple' && output.components) {
      value = (value as any[]).map((item) =>
        processOutputTypes(output.components, item as Result)
      );
    }

    result[name] = value;
  });

  return result;
}

/**
 * Decode contract function output using ABI
 * @param abi - Contract ABI
 * @param functionName - Function name to decode
 * @param output - Raw output data
 * @returns Decoded output as object with named fields
 */
export function decoder(
  abi: any[],
  functionName: string,
  output: any
): Record<string, any> | null {
  try {
    const iface = new Interface(abi);
    const fragment = iface.getFunction(functionName);

    if (!fragment) {
      throw new Error(`Function ${functionName} not found in ABI`);
    }

    // If output is already decoded (Result type), process it
    if (typeof output === 'object' && !Array.isArray(output) && output.toArray) {
      return processOutputTypes(fragment.outputs, output);
    }

    // Decode the output
    const decoded = iface.decodeFunctionResult(fragment, output);

    // Process and return with named fields
    return processOutputTypes(fragment.outputs, decoded);
  } catch (error) {
    console.error(`Error decoding function ${functionName}:`, error);
    return null;
  }
}

/**
 * Convert hex string to number
 */
export function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

/**
 * Convert number to hex string
 */
export function numberToHex(num: number): string {
  return '0x' + num.toString(16);
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Format address to checksummed version
 */
export function toChecksumAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }
  // ethers.js getAddress() returns checksummed address
  return address;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}
