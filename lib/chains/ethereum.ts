export interface EthereumTransaction {
  hash: string;
  from: string;
  to?: string | null;
  valueWei: string;
  timestamp: Date;
  gasUsed?: string;
  effectiveGasPriceWei?: string;
}

export interface EthereumAdapter {
  getBalance(address: string): Promise<string>;
  getBalanceAtBlock(address: string, blockNumber: number): Promise<string>;
  getTransactions(
    address: string,
    fromDate: Date,
    toDate: Date
  ): Promise<EthereumTransaction[]>;
  calculateGasSpent(transactions: EthereumTransaction[]): string;
}

const ALCHEMY_HTTP_URL =
  process.env.ALCHEMY_HTTP_URL ??
  (process.env.ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "");

if (!ALCHEMY_HTTP_URL) {
  // Fail fast in development if misconfigured. In production this will surface as a runtime error.
  console.warn(
    "ALCHEMY_HTTP_URL or ALCHEMY_API_KEY is not set. Ethereum RPC calls will fail."
  );
}

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  if (!ALCHEMY_HTTP_URL) {
    throw new Error("Alchemy HTTP URL is not configured");
  }

  const payload: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  };

  const res = await fetch(ALCHEMY_HTTP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      console.error("Alchemy RPC rate limit hit (429). Response:", text);
      throw new Error("Alchemy rate limit (429 Too Many Requests)");
    }
    throw new Error(`RPC request failed: ${res.status} ${res.statusText} - ${text}`);
  }

  const body = (await res.json()) as JsonRpcResponse<T>;
  if (body.error) {
    throw new Error(`RPC error ${body.error.code}: ${body.error.message}`);
  }

  if (body.result === undefined) {
    throw new Error(`RPC ${method} returned no result`);
  }

  return body.result;
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

function hexToNumber(hex: string): number {
  return Number(hexToBigInt(hex));
}

function toBlockTag(blockNumber: number | "latest"): string {
  if (blockNumber === "latest") return "latest";
  return `0x${blockNumber.toString(16)}`;
}

export async function getLatestBlockNumber(): Promise<number> {
  const hex = await rpcCall<string>("eth_blockNumber", []);
  return parseInt(hex, 16);
}

export async function getBalance(address: string): Promise<string> {
  const hex = await rpcCall<string>("eth_getBalance", [address, "latest"]);
  return hexToBigInt(hex).toString();
}

export async function getBalanceAtBlock(
  address: string,
  blockNumber: number
): Promise<string> {
  const hex = await rpcCall<string>("eth_getBalance", [
    address,
    toBlockTag(blockNumber)
  ]);
  return hexToBigInt(hex).toString();
}

type AlchemyTransfer = {
  hash: string;
  from: string;
  to?: string | null;
  value?: string | null;
  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyTransfersResult = {
  transfers: AlchemyTransfer[];
  pageKey?: string;
};

async function getAddressTransfers(
  params: Record<string, unknown>
): Promise<AlchemyTransfersResult> {
  return rpcCall<AlchemyTransfersResult>("alchemy_getAssetTransfers", [params]);
}

export async function getTransactions(
  address: string,
  fromDate: Date,
  toDate: Date
): Promise<EthereumTransaction[]> {
  // Estimate block range for the given time window, anchored at the latest block.
  const latestBlock = await getLatestBlockNumber();
  const seconds =
    (toDate.getTime() - fromDate.getTime()) / 1000 > 0
      ? (toDate.getTime() - fromDate.getTime()) / 1000
      : 0;
  const approxBlocks = Math.ceil(seconds / 12); // ~12s block time
  const padding = Math.ceil(approxBlocks * 0.2) + 200; // add some buffer
  const toBlock = latestBlock;
  const fromBlock = Math.max(0, toBlock - approxBlocks - padding);

  const baseParams = {
    category: ["external", "internal", "erc20", "erc721", "erc1155"],
    withMetadata: true,
    maxCount: "0x3e8", // 1000 per page
    order: "desc",
    fromBlock: toBlockTag(fromBlock),
    toBlock: toBlockTag(toBlock),
    fromAddress: address
  };

  const mergedRaw: AlchemyTransfer[] = [];
  let pageKey: string | undefined;
  let pages = 0;

  // Paginate a few pages backwards in time to cover high-activity wallets.
  while (pages < 5) {
    const params = pageKey ? { ...baseParams, pageKey } : baseParams;
    const { transfers, pageKey: nextPageKey } = await getAddressTransfers(params);
    if (!transfers || transfers.length === 0) {
      break;
    }
    mergedRaw.push(...transfers);
    pages += 1;
    pageKey = nextPageKey;
    if (!pageKey) break;
  }

  const mapped: EthereumTransaction[] = [];

  for (const t of mergedRaw) {
    const tsString = t.metadata?.blockTimestamp;
    if (!tsString) continue;
    const ts = new Date(tsString);
    if (ts < fromDate || ts > toDate) continue;

    mapped.push({
      hash: t.hash,
      from: t.from,
      to: t.to ?? null,
      // Alchemy returns value in ETH for some categories; for now we keep it as 0
      // since the current dashboard does not use per-tx values yet.
      valueWei: "0",
      timestamp: ts
    });
  }

  // Deduplicate by hash
  const byHash = new Map<string, EthereumTransaction>();
  for (const tx of mapped) {
    byHash.set(tx.hash, tx);
  }

  const unique = Array.from(byHash.values());

  // Fetch receipts to compute gas costs
  const withReceipts = await Promise.all(
    unique.map(async (tx) => {
      try {
        const receipt = await rpcCall<{
          gasUsed?: string;
          effectiveGasPrice?: string;
          gasPrice?: string;
        }>("eth_getTransactionReceipt", [tx.hash]);

        const gasUsedHex = receipt.gasUsed;
        const priceHex = receipt.effectiveGasPrice ?? receipt.gasPrice;

        if (!gasUsedHex || !priceHex) {
          return tx;
        }

        return {
          ...tx,
          gasUsed: hexToBigInt(gasUsedHex).toString(),
          effectiveGasPriceWei: hexToBigInt(priceHex).toString()
        };
      } catch {
        return tx;
      }
    })
  );

  return withReceipts;
}

export function calculateGasSpent(transactions: EthereumTransaction[]): string {
  let total = 0n;

  for (const tx of transactions) {
    if (!tx.gasUsed || !tx.effectiveGasPriceWei) continue;

    const gasUsed = BigInt(tx.gasUsed);
    const effectiveGasPrice = BigInt(tx.effectiveGasPriceWei);
    total += gasUsed * effectiveGasPrice;
  }

  return total.toString();
}

export const ethereumAdapter: EthereumAdapter = {
  getBalance,
  getBalanceAtBlock,
  getTransactions,
  calculateGasSpent
};
