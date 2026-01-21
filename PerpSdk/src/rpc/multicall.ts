import { Contract } from 'ethers';

/**
 * Call structure for multicall
 */
export interface MulticallCall {
  target: string;
  callData: string;
}

/**
 * Result structure from multicall
 */
export interface MulticallResult {
  blockNumber: number;
  returnData: string[];
}

/**
 * Multicall RPC
 * Allows batching multiple contract view calls into a single request
 */
export class MulticallRPC {
  constructor(private multicallContract: Contract) {}

  /**
   * Execute multiple calls in a single transaction
   * @param calls - Array of calls to execute
   * @returns Block number and return data from each call
   */
  async aggregate(calls: MulticallCall[]): Promise<MulticallResult> {
    const result = await this.multicallContract.aggregate(calls);

    return {
      blockNumber: Number(result.blockNumber || result[0]),
      returnData: Array.isArray(result.returnData) ? result.returnData : result[1],
    };
  }

  /**
   * Helper: Create call data for a contract function
   * @param contract - Contract instance
   * @param functionName - Function name
   * @param args - Function arguments
   * @returns Call data object
   */
  createCall(contract: Contract, functionName: string, args: any[] = []): MulticallCall {
    return {
      target: contract.target as string,
      callData: contract.interface.encodeFunctionData(functionName, args),
    };
  }

  /**
   * Helper: Decode return data from a multicall result
   * @param contract - Contract instance used for decoding
   * @param functionName - Function name that was called
   * @param returnData - Raw return data from multicall
   * @returns Decoded result
   */
  decodeResult(contract: Contract, functionName: string, returnData: string): any {
    return contract.interface.decodeFunctionResult(functionName, returnData);
  }

  /**
   * Execute multicall and decode results
   * @param calls - Array of call definitions with contract and function info
   * @returns Decoded results
   */
  async aggregateAndDecode(
    calls: Array<{
      contract: Contract;
      functionName: string;
      args?: any[];
    }>
  ): Promise<{
    blockNumber: number;
    results: any[];
  }> {
    // Create multicall calls
    const multicallCalls = calls.map((call) =>
      this.createCall(call.contract, call.functionName, call.args || [])
    );

    // Execute multicall
    const { blockNumber, returnData } = await this.aggregate(multicallCalls);

    // Decode results
    const results = returnData.map((data, index) => {
      const call = calls[index];
      return this.decodeResult(call.contract, call.functionName, data);
    });

    return {
      blockNumber,
      results,
    };
  }

  /**
   * Batch read multiple open trades
   * @param tradingStorageContract - TradingStorage contract instance
   * @param trader - Trader address
   * @param pairIndex - Pair index
   * @param indices - Array of trade indices
   * @returns Array of decoded trade data
   */
  async batchGetOpenTrades(
    tradingStorageContract: Contract,
    trader: string,
    pairIndex: number,
    indices: number[]
  ): Promise<any[]> {
    const calls = indices.map((index) => ({
      contract: tradingStorageContract,
      functionName: 'openTrades',
      args: [trader, pairIndex, index],
    }));

    const { results } = await this.aggregateAndDecode(calls);
    return results;
  }

  /**
   * Batch read multiple trade infos
   * @param tradingStorageContract - TradingStorage contract instance
   * @param trader - Trader address
   * @param pairIndex - Pair index
   * @param indices - Array of trade indices
   * @returns Array of decoded trade info data
   */
  async batchGetOpenTradesInfo(
    tradingStorageContract: Contract,
    trader: string,
    pairIndex: number,
    indices: number[]
  ): Promise<any[]> {
    const calls = indices.map((index) => ({
      contract: tradingStorageContract,
      functionName: 'openTradesInfo',
      args: [trader, pairIndex, index],
    }));

    const { results } = await this.aggregateAndDecode(calls);
    return results;
  }

  /**
   * Batch read pair information
   * @param pairStorageContract - PairStorage contract instance
   * @param pairIndices - Array of pair indices
   * @returns Array of decoded pair data
   */
  async batchGetPairs(pairStorageContract: Contract, pairIndices: number[]): Promise<any[]> {
    const calls = pairIndices.map((pairIndex) => ({
      contract: pairStorageContract,
      functionName: 'pairs',
      args: [pairIndex],
    }));

    const { results } = await this.aggregateAndDecode(calls);
    return results;
  }
}
