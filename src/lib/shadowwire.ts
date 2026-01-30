import wasmUrl from "@radr/shadowwire/wasm/settler_wasm_bg.wasm?url";
import {
  ShadowWireClient,
  initWASM,
  isWASMSupported,
  RecipientNotFoundError,
  NetworkError,
  TransferError,
  InvalidAddressError,
  InvalidAmountError,
} from "@radr/shadowwire";
import type { TransferResponse, TransferType, WalletAdapter } from "@radr/shadowwire";

let clientSingleton: ShadowWireClient | null = null;
let wasmInitPromise: Promise<void> | null = null;

export function getShadowWireClient(): ShadowWireClient {
  if (!clientSingleton) {
    clientSingleton = new ShadowWireClient();
  }
  return clientSingleton;
}

export async function ensureShadowWireReady(): Promise<void> {
  if (!isWASMSupported()) {
    throw new Error("WebAssembly is not supported in this browser.");
  }

  if (!wasmInitPromise) {
    wasmInitPromise = initWASM(wasmUrl);
  }

  await wasmInitPromise;
}

export type ShadowWireTransferResult = {
  transferType: TransferType;
  response: TransferResponse;
};

export async function shadowWireTransferWithFallback(params: {
  sender: string;
  recipient: string;
  amount: number;
  wallet: WalletAdapter;
  preferredType?: TransferType;
}): Promise<ShadowWireTransferResult> {
  const client = getShadowWireClient();
  const preferredType: TransferType = params.preferredType ?? "internal";

  await ensureShadowWireReady();

  try {
    const response = await client.transfer({
      sender: params.sender,
      recipient: params.recipient,
      amount: params.amount,
      token: "SOL",
      type: preferredType,
      wallet: params.wallet,
    });

    return { transferType: preferredType, response };
  } catch (err) {
    if (preferredType === "internal" && err instanceof RecipientNotFoundError) {
      const response = await client.transfer({
        sender: params.sender,
        recipient: params.recipient,
        amount: params.amount,
        token: "SOL",
        type: "external",
        wallet: params.wallet,
      });
      return { transferType: "external", response };
    }
    throw err;
  }
}

export function formatShadowWireError(err: unknown): { title: string; description?: string } {
  if (err instanceof RecipientNotFoundError) {
    return {
      title: "Recipient not found",
      description: "The recipient is not registered in ShadowWire. External transfer may be required.",
    };
  }

  if (err instanceof InvalidAddressError) {
    return { title: "Invalid address", description: err.message };
  }

  if (err instanceof InvalidAmountError) {
    return { title: "Invalid amount", description: err.message };
  }

  if (err instanceof TransferError) {
    return { title: "Transfer failed", description: err.message };
  }

  if (err instanceof NetworkError) {
    return { title: "Network error", description: err.message };
  }

  if (err instanceof Error) {
    return { title: "Transfer failed", description: err.message };
  }

  return { title: "Transfer failed" };
}

