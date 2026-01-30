import { clusterApiUrl, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Faceless Payments is mainnet-only for privacy payments via ShadowWire
export type SolanaCluster = "mainnet-beta";

const CLUSTER: SolanaCluster = "mainnet-beta";

export function getSolanaCluster(): SolanaCluster {
  return CLUSTER;
}

export function getSolanaRpcUrl(): string {
  // Use custom RPC to avoid rate limits on public endpoint
  return import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(CLUSTER);
}

export function getSolscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

// Token mint addresses for verification
const TOKEN_MINTS: Record<string, string> = {
  USD1: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mint (USD1 uses same)
};

const TOKEN_DECIMALS: Record<string, number> = {
  SOL: 9,
  USD1: 6,
};

interface PaymentVerificationResult {
  found: boolean;
  signature?: string;
  amount?: number;
  timestamp?: number;
}

/**
 * Verify if a payment was received by checking recent transactions
 * Uses Solana RPC to find incoming transfers to the recipient's wallet
 */
export async function verifyPaymentReceived(
  connection: Connection,
  recipientAddress: string,
  expectedAmount: number,
  token: "SOL" | "USD1",
  sinceTimestamp?: Date
): Promise<PaymentVerificationResult> {
  try {
    const recipientPubkey = new PublicKey(recipientAddress);
    const decimals = TOKEN_DECIMALS[token];
    const tolerance = 0.02; // 2% tolerance for fees
    const minAmount = expectedAmount * (1 - tolerance);
    const maxAmount = expectedAmount * (1 + tolerance);

    // Get recent signatures for this address
    const signatures = await connection.getSignaturesForAddress(recipientPubkey, {
      limit: 20, // Check last 20 transactions
    });

    if (!signatures.length) {
      return { found: false };
    }

    // Filter by timestamp if provided
    const cutoffTime = sinceTimestamp ? sinceTimestamp.getTime() / 1000 : 0;
    const recentSignatures = signatures.filter(
      (sig) => sig.blockTime && sig.blockTime >= cutoffTime && !sig.err
    );

    if (!recentSignatures.length) {
      return { found: false };
    }

    // Check each transaction for matching transfer
    for (const sigInfo of recentSignatures) {
      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx?.meta) continue;

        if (token === "SOL") {
          // Check SOL balance changes
          const accountIndex = tx.transaction.message.accountKeys.findIndex(
            (key) => key.pubkey.toBase58() === recipientAddress
          );

          if (accountIndex >= 0 && tx.meta.postBalances && tx.meta.preBalances) {
            const preBalance = tx.meta.preBalances[accountIndex] / LAMPORTS_PER_SOL;
            const postBalance = tx.meta.postBalances[accountIndex] / LAMPORTS_PER_SOL;
            const received = postBalance - preBalance;

            if (received >= minAmount && received <= maxAmount) {
              return {
                found: true,
                signature: sigInfo.signature,
                amount: received,
                timestamp: sigInfo.blockTime ?? undefined,
              };
            }
          }
        } else {
          // Check SPL token transfers
          const tokenBalances = tx.meta.postTokenBalances;
          const preTokenBalances = tx.meta.preTokenBalances;

          if (tokenBalances && preTokenBalances) {
            for (let i = 0; i < tokenBalances.length; i++) {
              const postBal = tokenBalances[i];
              if (postBal.owner !== recipientAddress) continue;

              // Find matching pre-balance
              const preBal = preTokenBalances.find(
                (p) => p.accountIndex === postBal.accountIndex
              );

              const preAmount = preBal?.uiTokenAmount?.uiAmount ?? 0;
              const postAmount = postBal.uiTokenAmount?.uiAmount ?? 0;
              const received = postAmount - preAmount;

              if (received >= minAmount && received <= maxAmount) {
                return {
                  found: true,
                  signature: sigInfo.signature,
                  amount: received,
                  timestamp: sigInfo.blockTime ?? undefined,
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn("Error parsing transaction:", sigInfo.signature, err);
        continue;
      }
    }

    return { found: false };
  } catch (err) {
    console.error("Payment verification error:", err);
    return { found: false };
  }
}
