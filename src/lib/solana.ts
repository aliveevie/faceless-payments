import { clusterApiUrl } from "@solana/web3.js";

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";
export type SolanaRpcProviderId = "auto" | "proxy" | "solana" | "ankr" | "publicnode";

const CLUSTER_STORAGE_KEY = "faceless_solana_cluster";
const RPC_MAINNET_STORAGE_KEY = "faceless_solana_rpc_mainnet";
const RPC_DEVNET_STORAGE_KEY = "faceless_solana_rpc_devnet";

const DEFAULT_CLUSTER: SolanaCluster = "devnet";

export const SOLANA_CONFIG_CHANGED_EVENT = "faceless:solana-config-changed";

const RPC_PROVIDERS: Record<
  SolanaRpcProviderId,
  { label: string; urls: Partial<Record<SolanaCluster, string>> }
> = {
  auto: {
    label: "Auto",
    urls: {},
  },
  proxy: {
    label: "Proxy (recommended)",
    urls: {
      devnet: "/rpc/devnet",
      "mainnet-beta": "/rpc/mainnet",
    },
  },
  solana: {
    label: "Solana",
    urls: {
      "mainnet-beta": clusterApiUrl("mainnet-beta"),
      devnet: clusterApiUrl("devnet"),
      testnet: clusterApiUrl("testnet"),
    },
  },
  // Public, no-key endpoints (may have rate limits).
  ankr: {
    label: "Ankr",
    urls: {
      "mainnet-beta": "https://rpc.ankr.com/solana",
      devnet: "https://rpc.ankr.com/solana_devnet",
    },
  },
  publicnode: {
    label: "PublicNode",
    urls: {
      "mainnet-beta": "https://solana-rpc.publicnode.com",
      devnet: "https://solana-devnet.rpc.publicnode.com",
    },
  },
};

function toAbsoluteHttpUrl(url: string): string {
  // web3.js Connection requires an absolute http(s) URL.
  // Allow same-origin proxy paths like "/rpc/devnet".
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) {
    const origin =
      (typeof window !== "undefined" && window.location?.origin) ||
      (typeof globalThis !== "undefined" && (globalThis as any).location?.origin) ||
      "";
    if (origin) return new URL(url, origin).toString();
  }
  return url;
}

export function getRpcProviders(): Array<{ id: SolanaRpcProviderId; label: string }> {
  return (Object.keys(RPC_PROVIDERS) as SolanaRpcProviderId[]).map((id) => ({
    id,
    label: RPC_PROVIDERS[id].label,
  }));
}

export function getRpcUrlForProvider(cluster: SolanaCluster, id: SolanaRpcProviderId): string | null {
  const raw = RPC_PROVIDERS[id]?.urls?.[cluster] ?? null;
  return raw ? toAbsoluteHttpUrl(raw) : null;
}

export function getAutoRpcOrder(): SolanaRpcProviderId[] {
  // Prioritize reliable free RPCs (Ankr/PublicNode have better rate limits than official Solana)
  return import.meta.env.DEV
    ? ["proxy", "ankr", "publicnode", "solana"]
    : ["ankr", "publicnode", "solana"];
}

export function getRpcCandidates(cluster: SolanaCluster, preferred?: SolanaRpcProviderId): Array<{
  id: SolanaRpcProviderId;
  label: string;
  url: string;
}> {
  const autoOrder = getAutoRpcOrder();
  const order =
    preferred && preferred !== "auto"
      ? [preferred, ...autoOrder.filter((x) => x !== preferred)]
      : autoOrder;

  const out: Array<{ id: SolanaRpcProviderId; label: string; url: string }> = [];
  for (const id of order) {
    const url = getRpcUrlForProvider(cluster, id);
    if (url) out.push({ id, label: RPC_PROVIDERS[id].label, url });
  }
  return out;
}

export function getSolanaCluster(): SolanaCluster {
  try {
    const raw = localStorage.getItem(CLUSTER_STORAGE_KEY);
    if (raw === "mainnet-beta" || raw === "devnet") return raw;
  } catch {
    // ignore
  }
  return DEFAULT_CLUSTER;
}

export function isMainnet(): boolean {
  return getSolanaCluster() === "mainnet-beta";
}

export function setSolanaCluster(cluster: SolanaCluster): void {
  try {
    localStorage.setItem(CLUSTER_STORAGE_KEY, cluster);
    window.dispatchEvent(new CustomEvent(SOLANA_CONFIG_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

function getRpcStorageKey(cluster: SolanaCluster): string | null {
  if (cluster === "mainnet-beta") return RPC_MAINNET_STORAGE_KEY;
  if (cluster === "devnet") return RPC_DEVNET_STORAGE_KEY;
  return null;
}

export function getSolanaRpcUrl(cluster: SolanaCluster): string {
  const key = getRpcStorageKey(cluster);
  const stored = key ? (localStorage.getItem(key) as SolanaRpcProviderId | null) : null;
  const storedId: SolanaRpcProviderId = stored && stored in RPC_PROVIDERS ? stored : "auto";

  const autoOrder = getAutoRpcOrder();
  const order: SolanaRpcProviderId[] = storedId === "auto" ? autoOrder : [storedId, ...autoOrder.filter((x) => x !== storedId)];
  for (const id of order) {
    const url = getRpcUrlForProvider(cluster, id);
    if (url) return url;
  }

  return toAbsoluteHttpUrl(clusterApiUrl(cluster));
}

export function getSelectedRpcProviderId(cluster: SolanaCluster): SolanaRpcProviderId {
  const key = getRpcStorageKey(cluster);
  const stored = key ? (localStorage.getItem(key) as SolanaRpcProviderId | null) : null;
  return stored && stored in RPC_PROVIDERS ? stored : "auto";
}

export function setSelectedRpcProviderId(cluster: SolanaCluster, id: SolanaRpcProviderId): void {
  const key = getRpcStorageKey(cluster);
  if (!key) return;
  try {
    localStorage.setItem(key, id);
    window.dispatchEvent(new CustomEvent(SOLANA_CONFIG_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function rotateRpcProvider(cluster: SolanaCluster): SolanaRpcProviderId {
  const key = getRpcStorageKey(cluster);
  if (!key) return "auto";
  const current = getSelectedRpcProviderId(cluster);
  const cycle: SolanaRpcProviderId[] = ["auto", "proxy", "solana", "ankr", "publicnode"];
  const idx = Math.max(0, cycle.indexOf(current));
  const next = cycle[(idx + 1) % cycle.length];
  setSelectedRpcProviderId(cluster, next);
  return next;
}

export function getSolscanTxUrl(signature: string): string {
  const base = `https://solscan.io/tx/${signature}`;
  const cluster = getSolanaCluster();
  return cluster === "mainnet-beta" ? base : `${base}?cluster=${cluster}`;
}

