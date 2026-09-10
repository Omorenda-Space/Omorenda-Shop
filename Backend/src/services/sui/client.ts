import { config } from "../../config/config";

type SuiClientInstance = import("@mysten/sui/jsonRpc").SuiJsonRpcClient;

let cached: SuiClientInstance | null = null;

export async function getSuiClient(): Promise<SuiClientInstance> {
  if (cached) return cached;
  if (!config.sui.rpcUrl) {
    throw new Error("Missing SUI_RPC_URL");
  }
  const { SuiJsonRpcClient } = await import("@mysten/sui/jsonRpc");
  cached = new SuiJsonRpcClient({
    url: config.sui.rpcUrl,
    network: config.sui.network,
  });
  return cached;
}
