import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle2, ExternalLink, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Invoice, useInvoices } from "@/contexts/InvoiceContext";
import { Button } from "./ui/button";
import { getSolanaCluster, getSolscanTxUrl, setSolanaCluster } from "@/lib/solana";

// ShadowWire (aligned with `ShadowWire/examples/react-example.tsx`)
import wasmUrl from "@radr/shadowwire/wasm/settler_wasm_bg.wasm?url";
import {
  ShadowWireClient,
  initWASM,
  isWASMSupported,
  InsufficientBalanceError,
  RecipientNotFoundError,
} from "@radr/shadowwire";

interface PaymentFormProps {
  invoice: Invoice;
}

type TransferMode = "normal" | "shadowwire_private" | "shadowwire_anonymous";

export function PaymentForm({ invoice: initialInvoice }: PaymentFormProps) {
  const { publicKey, connected, signMessage, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { upsertInvoice, invoices } = useInvoices();
  
  // Get the latest invoice from context to keep it in sync
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  
  // Update invoice when context changes (after payment)
  useEffect(() => {
    const latestInvoice = invoices.find(inv => inv.id === initialInvoice.id);
    if (latestInvoice) {
      console.log('Invoice updated from context:', latestInvoice);
      setInvoice(latestInvoice);
      // Also update isPaid state
      if (latestInvoice.status === 'paid') {
        setIsPaid(true);
      }
    }
  }, [invoices, initialInvoice.id]);
  
  const [client] = useState(() => new ShadowWireClient());
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(invoice.status === 'paid');
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [balanceSOL, setBalanceSOL] = useState<number | null>(null);
  const [shadowWireError, setShadowWireError] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState<TransferMode>("normal");
  const [cluster, setCluster] = useState(getSolanaCluster());

  const explorerUrl = useMemo(() => {
    const sig = transactionSignature || invoice.transactionSignature;
    return sig ? getSolscanTxUrl(sig) : null;
  }, [transactionSignature, invoice.transactionSignature]);
  
  // Update isPaid when invoice status changes
  useEffect(() => {
    setIsPaid(invoice.status === 'paid');
  }, [invoice.status]);

  const switchNetwork = (next: typeof cluster) => {
    setSolanaCluster(next);
    // Wallet adapter connection endpoint is configured at provider init.
    // Reload is the most reliable way to rewire the connection.
    window.location.reload();
  };

  const decodeBase64ToUint8Array = (b64: string): Uint8Array => {
    const binStr = globalThis.atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  };

  const confirmSignature = async (signature: string, timeoutMs: number = 60_000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      if (status.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
      if (
        status.value?.confirmationStatus === "confirmed" ||
        status.value?.confirmationStatus === "finalized"
      ) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };

  const loadBalance = async (walletAddress: string) => {
    try {
      const data = await client.getBalance(walletAddress, "SOL");
      setBalanceSOL(data.available / 1e9);
    } catch (err) {
      // Balance is helpful UX, but not critical for transfer.
      console.warn("Balance load failed:", err);
    }
  };

  const ensurePoolBalance = async (walletAddress: string, requiredSol: number) => {
    // ShadowWire transfers spend from the ShadowWire pool balance, not directly from the wallet.
    const data = await client.getBalance(walletAddress, "SOL");
    const availableSol = data.available / 1e9;

    if (availableSol >= requiredSol) {
      setBalanceSOL(availableSol);
      return;
    }

    // If user doesn't have pool balance, they must deposit (this DOES require a wallet transaction).
    if (!sendTransaction || !signTransaction) {
      throw new Error("This wallet cannot sign transactions required for deposit.");
    }

    const lamportsToDeposit = Math.ceil((requiredSol - availableSol) * 1e9);
    toast.info("Depositing to ShadowWire pool...", {
      description: `Depositing ${(lamportsToDeposit / 1e9).toFixed(4)} SOL`,
      duration: 10000,
    });

    const depositResp = await client.deposit({
      wallet: walletAddress,
      amount: lamportsToDeposit,
    });

    const txBytes = decodeBase64ToUint8Array(depositResp.unsigned_tx_base64);
    const tx = Transaction.from(txBytes);

    // Refresh blockhash for reliability.
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey ?? tx.feePayer;

    const depositSig = await sendTransaction(tx, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    const depositUrl = getSolscanTxUrl(depositSig);
    toast.info("Deposit submitted", {
      description: `Tx: ${depositSig.slice(0, 8)}...${depositSig.slice(-8)}`,
      action: {
        label: "View on Solscan",
        onClick: () => window.open(depositUrl, "_blank"),
      },
      duration: 12000,
    });

    const confirmed = await confirmSignature(depositSig, 90_000);
    if (!confirmed) {
      throw new Error("Deposit submitted but not confirmed yet. Please retry in a moment.");
    }

    await loadBalance(walletAddress);
  };

  useEffect(() => {
    async function init() {
      if (!isWASMSupported()) {
        setShadowWireError("WebAssembly not supported");
        return;
      }

      try {
        // Vite-friendly WASM URL (same intent as '/wasm/settler_wasm_bg.wasm' in examples)
        await initWASM(wasmUrl);
        setWasmInitialized(true);

        if (publicKey) {
          await loadBalance(publicKey.toBase58());
        }
      } catch (err: any) {
        setShadowWireError("Initialization failed: " + (err?.message ?? String(err)));
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!wasmInitialized) return;
    if (!publicKey) return;
    loadBalance(publicKey.toBase58());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasmInitialized, publicKey?.toBase58()]);

  const handleNormalTransfer = async (sender: string) => {
    if (!sendTransaction) {
      throw new Error("Wallet cannot send transactions.");
    }

    const recipientPubkey = new PublicKey(invoice.recipientAddress);
    const lamports = Math.round(invoice.amount * LAMPORTS_PER_SOL);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
    const tx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: publicKey ?? undefined,
    }).add(
      SystemProgram.transfer({
        fromPubkey: publicKey!,
        toPubkey: recipientPubkey,
        lamports,
      }),
    );

    const signature = await sendTransaction(tx, connection, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    if (!signature) {
      throw new Error("Wallet did not return a transaction signature.");
    }

    setTransactionSignature(signature);
    const txUrl = getSolscanTxUrl(signature);

    // Store pending immediately to prevent double-pay clicks.
    upsertInvoice({
      ...invoice,
      status: "pending",
      payerAddress: sender,
      transactionSignature: signature,
      paymentMethod: "normal",
      isAnonymous: false,
    });

    toast.info("Transaction submitted", {
      description: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      action: {
        label: "View on Solscan",
        onClick: () => window.open(txUrl, "_blank"),
      },
      duration: 10000,
    });

    const confirmed = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    if (confirmed.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmed.value.err)}`);
    }

    upsertInvoice({
      ...invoice,
      status: "paid",
      payerAddress: sender,
      paidAt: new Date(),
      transactionSignature: signature,
      paymentMethod: "normal",
      isAnonymous: false,
    });

    setInvoice((prev) => ({
      ...prev,
      status: "paid",
      payerAddress: sender,
      paidAt: new Date(),
      transactionSignature: signature,
      paymentMethod: "normal",
      isAnonymous: false,
    }));
    setIsPaid(true);
  };

  const handlePayment = async () => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // If we already have a submitted signature for this pending invoice, don't let user double-submit.
    if (invoice.status === "pending" && invoice.transactionSignature) {
      toast.info("Transaction already submitted", {
        description: `Signature: ${invoice.transactionSignature.slice(0, 8)}...${invoice.transactionSignature.slice(-8)}`,
        action: {
          label: "View on Solscan",
          onClick: () => window.open(getSolscanTxUrl(invoice.transactionSignature!), "_blank"),
        },
        duration: 12000,
      });
      return;
    }

    const currentCluster = getSolanaCluster();
    setCluster(currentCluster);

    // Prevent duplicate payments - check if invoice is already paid
    if (invoice.status === 'paid') {
      toast.error('This invoice has already been paid', {
        description: invoice.transactionSignature 
          ? `Transaction: ${invoice.transactionSignature.slice(0, 8)}...${invoice.transactionSignature.slice(-8)}`
          : 'Please check the invoice details.',
      });
      return;
    }

    // Check if current user already paid this invoice
    if (invoice.payerAddress === publicKey.toBase58()) {
      toast.error('You have already paid this invoice', {
        description: 'This invoice was already paid by your wallet address.',
      });
      return;
    }

    setIsProcessing(true);
    setShadowWireError(null);

    try {
      const sender = publicKey.toBase58();
      const recipient = invoice.recipientAddress;

      // Make sure this invoice is present locally to reflect on dashboard.
      upsertInvoice(invoice);

      if (transferMode === "normal") {
        await handleNormalTransfer(sender);
        return;
      }

      // ShadowWire modes require mainnet-beta.
      if (currentCluster !== "mainnet-beta") {
        toast.error("ShadowWire requires Solana Mainnet-Beta", {
          description: "Switch the app + wallet network to mainnet-beta to use private/anonymous transfers.",
        });
        return;
      }

      if (!wasmInitialized) {
        toast.error("ShadowWire not initialized", {
          description: shadowWireError ?? "Please refresh and try again.",
        });
        return;
      }

      if (!signMessage) {
        toast.error("Wallet does not support message signing", {
          description: "ShadowWire requires a wallet that can sign messages (e.g., Phantom, Solflare).",
        });
        return;
      }

      // Ensure funds are available in the ShadowWire pool (deposit if needed).
      await ensurePoolBalance(sender, invoice.amount);

      // Attempt internal (private) transfer first, fall back to external if recipient isn't found.
      let transferType: "internal" | "external" =
        transferMode === "shadowwire_anonymous" ? "external" : "internal";
      let result: any;
      try {
        result = await client.transfer({
          sender,
          recipient,
          amount: invoice.amount,
          token: "SOL",
          type: transferType,
          wallet: { signMessage: (m) => signMessage(m) },
        });
      } catch (err: any) {
        if (transferType === "internal" && err instanceof RecipientNotFoundError) {
          transferType = "external";
          result = await client.transfer({
            sender,
            recipient,
            amount: invoice.amount,
            token: "SOL",
            type: "external",
            wallet: { signMessage: (m) => signMessage(m) },
          });
        } else {
          throw err;
        }
      }

      const signature = (result?.tx_signature as string | undefined) ?? "";
      if (!signature) {
        throw new Error("ShadowWire did not return a transaction signature. Transfer not completed.");
      }

      setTransactionSignature(signature);

      const txUrl = getSolscanTxUrl(signature);

      toast.success("Transfer submitted", {
        description:
          transferType === "internal"
            ? `Private transfer • ${signature.slice(0, 8)}...${signature.slice(-8)}`
            : `External transfer • ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        action: {
          label: "View on Solscan",
          onClick: () => window.open(txUrl, "_blank"),
        },
        duration: 10000,
      });

      if (transferType === "external") {
        toast.message("Recipient not found for private transfer", {
          description: "Sent as an external transfer (amount visible) to ensure delivery.",
          duration: 8000,
        });
      }

      // Store pending immediately (prevents double-pay), then confirm before marking paid.
      upsertInvoice({
        ...invoice,
        status: "pending",
        payerAddress: sender,
        transactionSignature: signature,
        paymentMethod: "shadowwire",
        isAnonymous: transferMode === "shadowwire_anonymous",
      });

      const confirmed = await confirmSignature(signature, 120_000);
      if (!confirmed) {
        toast.warning("Waiting for confirmation", {
          description: "Transfer submitted but not confirmed yet. Please check Solscan.",
          action: {
            label: "View on Solscan",
            onClick: () => window.open(txUrl, "_blank"),
          },
          duration: 15000,
        });
        return;
      }

      upsertInvoice({
        ...invoice,
        status: "paid",
        payerAddress: sender,
        paidAt: new Date(),
        transactionSignature: signature,
        paymentMethod: "shadowwire",
        isAnonymous: transferMode === "shadowwire_anonymous",
      });

      setInvoice((prev) => ({
        ...prev,
        status: "paid",
        payerAddress: sender,
        paidAt: new Date(),
        transactionSignature: signature,
        paymentMethod: "shadowwire",
        isAnonymous: transferMode === "shadowwire_anonymous",
      }));

      setIsPaid(true);
      await loadBalance(sender);

    } catch (error: any) {
      console.error("Payment error:", error);

      if (error instanceof RecipientNotFoundError) {
        setShadowWireError("Recipient not found. Try external transfer.");
      } else if (error instanceof InsufficientBalanceError) {
        setShadowWireError("Insufficient ShadowWire balance. Please deposit to the ShadowWire pool.");
      } else {
        setShadowWireError("Transfer failed: " + (error?.message ?? String(error)));
      }

      toast.error("Transfer failed", {
        description: error?.message ?? "Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPaid || invoice.status === 'paid') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        </div>
        <h3 className="font-mono text-2xl font-bold text-green-400 mb-2">Payment Complete</h3>
        <p className="text-muted-foreground mb-4">
          This invoice has been paid successfully.
        </p>
        
        {invoice.payerAddress && (
          <p className="text-sm text-muted-foreground mb-2 font-mono">
            Paid by: {invoice.payerAddress.slice(0, 8)}...{invoice.payerAddress.slice(-6)}
          </p>
        )}
        
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-mono mt-4"
          >
            View transaction on Solscan
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </motion.div>
    );
  }

  if (invoice.status === 'expired') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="font-mono text-2xl font-bold text-destructive mb-2">Invoice Expired</h3>
        <p className="text-muted-foreground">
          This invoice is no longer valid.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card-glow p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold">Pay Invoice</h2>
          <p className="text-sm text-muted-foreground">Send SOL to complete payment</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground font-mono mb-1">Amount to pay</p>
          <p className="text-3xl font-bold font-mono text-gradient">
            {invoice.amount} <span className="text-lg">SOL</span>
          </p>
        </div>

        {invoice.description && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-sm text-muted-foreground font-mono mb-1">For</p>
            <p className="text-foreground">{invoice.description}</p>
          </div>
        )}

        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground font-mono mb-1">Sending to</p>
          <p className="font-mono text-sm truncate text-foreground/80">
            {invoice.recipientAddress}
          </p>
        </div>
      </div>

      {!wasmInitialized && !shadowWireError ? (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <h3 className="font-mono text-lg font-bold mb-2">Initializing ShadowWire...</h3>
            <p className="text-sm text-muted-foreground">
              Preparing zero-knowledge proof system in your browser.
            </p>
          </div>
        </div>
      ) : !connected ? (
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Connect your wallet to pay</p>
          <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-12 !px-8 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all !mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-xs text-muted-foreground font-mono mb-2">Transfer</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={transferMode === "normal" ? "glow" : "glass"}
                  onClick={() => setTransferMode("normal")}
                  disabled={isProcessing}
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={transferMode === "shadowwire_private" ? "glow" : "glass"}
                  onClick={() => setTransferMode("shadowwire_private")}
                  disabled={isProcessing}
                >
                  Private
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={transferMode === "shadowwire_anonymous" ? "glow" : "glass"}
                  onClick={() => setTransferMode("shadowwire_anonymous")}
                  disabled={isProcessing}
                >
                  Anonymous
                </Button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-xs text-muted-foreground font-mono mb-2">Network</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={cluster === "devnet" ? "glow" : "glass"}
                  onClick={() => switchNetwork("devnet")}
                  disabled={isProcessing}
                >
                  Devnet
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cluster === "mainnet-beta" ? "glow" : "glass"}
                  onClick={() => switchNetwork("mainnet-beta")}
                  disabled={isProcessing}
                >
                  Mainnet
                </Button>
              </div>
            </div>
          </div>

          {transferMode !== "normal" && balanceSOL !== null && (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
              <p className="text-xs text-muted-foreground font-mono">ShadowWire Balance</p>
              <p className="font-mono text-sm">
                Available: <span className="text-foreground">{balanceSOL.toFixed(4)} SOL</span>
              </p>
            </div>
          )}

          {shadowWireError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-mono text-destructive text-center">{shadowWireError}</p>
            </div>
          )}

          <Button
            variant="glow"
            size="lg"
            className="w-full group"
            onClick={handlePayment}
            disabled={isProcessing || (transferMode !== "normal" && !wasmInitialized)}
          >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              Pay {invoice.amount} SOL
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          {transferMode === "normal"
            ? `Normal transfer on Solana ${cluster}`
            : "ShadowWire transfer on Solana Mainnet-Beta"}
        </p>
      </div>
    </motion.div>
  );
}
