import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowRight, AlertCircle, CheckCircle2, ExternalLink, Loader2, Wallet, Shield, EyeOff, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Invoice, InvoiceToken, useInvoices } from "@/contexts/InvoiceContext";
import { Button } from "./ui/button";
import { getSolscanTxUrl, verifyPaymentReceived } from "@/lib/solana";

// ShadowWire SDK
import wasmUrl from "@radr/shadowwire/wasm/settler_wasm_bg.wasm?url";
import {
  ShadowWireClient,
  initWASM,
  isWASMSupported,
  InsufficientBalanceError,
  RecipientNotFoundError,
} from "@radr/shadowwire";

// Token configuration for ShadowWire (mainnet-only)
const TOKEN_INFO: Record<InvoiceToken, { name: string; decimals: number; minAmount: number; feePercent: number }> = {
  SOL: { name: "Solana", decimals: 9, minAmount: 0.1, feePercent: 0.5 },
  USD1: { name: "USD1 Stablecoin", decimals: 6, minAmount: 1, feePercent: 0.3 },
};

interface PaymentFormProps {
  invoice: Invoice;
}

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
      setInvoice(latestInvoice);
      if (latestInvoice.status === 'paid') {
        setIsPaid(true);
      }
    }
  }, [invoices, initialInvoice.id]);

  // Enable debug mode to see API requests/responses in console
  const [client] = useState(() => new ShadowWireClient({ debug: true }));
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(invoice.status === 'paid');
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [shadowWireError, setShadowWireError] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Use invoice's token (SOL or USD1) - payer must pay in the requested token
  const invoiceToken: InvoiceToken = invoice.token || 'SOL';
  const tokenInfo = TOKEN_INFO[invoiceToken];

  // Calculate fees for ShadowWire transfers
  // Fee is deducted from amount - recipient gets (amount - fee)
  const feeInfo = useMemo(() => {
    const fee = invoice.amount * (tokenInfo.feePercent / 100);
    return {
      feePercent: tokenInfo.feePercent,
      fee: fee,
      netToRecipient: invoice.amount - fee, // What recipient actually gets
      minAmount: tokenInfo.minAmount,
      isBelowMin: invoice.amount < tokenInfo.minAmount,
    };
  }, [invoice.amount, tokenInfo]);

  const explorerUrl = useMemo(() => {
    const sig = transactionSignature || invoice.transactionSignature;
    return sig ? getSolscanTxUrl(sig) : null;
  }, [transactionSignature, invoice.transactionSignature]);

  // Update isPaid when invoice status changes
  useEffect(() => {
    setIsPaid(invoice.status === 'paid');
  }, [invoice.status]);

  // AUTOMATIC PAYMENT VERIFICATION
  // Poll the blockchain to detect when payment has been received
  // This runs for ANY viewer of a pending invoice - no wallet connection required
  useEffect(() => {
    // Don't verify if already paid
    if (invoice.status === 'paid' || isPaid) {
      return;
    }

    let isCancelled = false;
    let pollCount = 0;
    const maxPolls = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    const pollInterval = 5000; // 5 seconds between checks

    const verifyPayment = async () => {
      if (isCancelled || pollCount >= maxPolls) return;

      setIsVerifyingPayment(true);
      pollCount++;

      try {
        console.log(`[AutoVerify] Checking for payment (attempt ${pollCount}/${maxPolls})...`);

        const result = await verifyPaymentReceived(
          connection,
          invoice.recipientAddress,
          invoice.amount,
          invoiceToken,
          invoice.createdAt // Only check transactions after invoice was created
        );

        if (result.found && result.signature) {
          console.log("[AutoVerify] Payment detected!", result);

          // Update invoice status
          upsertInvoice({
            ...invoice,
            status: "paid",
            paidAt: result.timestamp ? new Date(result.timestamp * 1000) : new Date(),
            transactionSignature: result.signature,
            paymentMethod: "shadowwire",
            isAnonymous: true, // ShadowWire payments are anonymous
          });

          setTransactionSignature(result.signature);
          setIsPaid(true);

          toast.success("Payment verified!", {
            description: `Received ${result.amount?.toFixed(4)} ${invoiceToken}`,
            action: {
              label: "View on Solscan",
              onClick: () => window.open(getSolscanTxUrl(result.signature!), "_blank"),
            },
          });

          return; // Stop polling
        }
      } catch (err) {
        console.warn("[AutoVerify] Verification check failed:", err);
      } finally {
        setIsVerifyingPayment(false);
      }

      // Schedule next poll if not cancelled
      if (!isCancelled && pollCount < maxPolls) {
        setTimeout(verifyPayment, pollInterval);
      }
    };

    // Start polling after a short delay
    const startDelay = setTimeout(verifyPayment, 2000);

    return () => {
      isCancelled = true;
      clearTimeout(startDelay);
    };
  }, [invoice.id, invoice.status, invoice.recipientAddress, invoice.amount, invoiceToken, isPaid, connection, upsertInvoice]);

  const decodeBase64ToUint8Array = (b64: string): Uint8Array => {
    const binStr = globalThis.atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  };

  // Validate that a signature looks like a valid Solana transaction signature
  // Valid signatures are 88 characters in base58 (64 bytes)
  const isValidSignature = (sig: string): boolean => {
    if (!sig || typeof sig !== 'string') return false;
    // Solana signatures are 64 bytes = 88 characters in base58
    // Allow some flexibility (85-90 chars) for encoding variations
    if (sig.length < 85 || sig.length > 90) return false;
    // Must be valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(sig);
  };

  const confirmSignature = async (signature: string, timeoutMs: number = 60_000): Promise<boolean> => {
    // Validate signature format first to avoid RPC errors
    if (!isValidSignature(signature)) {
      console.warn("Invalid signature format:", signature);
      throw new Error(`Invalid signature format: ${signature?.slice(0, 20)}...`);
    }

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
        if (status.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
          return true;
        }
      } catch (err: any) {
        // If RPC error (like WrongSize), don't keep retrying
        if (err?.message?.includes("WrongSize") || err?.message?.includes("Invalid param")) {
          console.error("RPC error checking signature:", err);
          throw new Error(`RPC error: ${err.message}`);
        }
        // Other transient errors, continue polling
        console.warn("Transient error checking signature:", err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };

  const loadBalance = async (walletAddress: string) => {
    try {
      const data = await client.getBalance(walletAddress, invoiceToken);
      setPoolBalance(data.available / Math.pow(10, tokenInfo.decimals));
    } catch (err) {
      console.warn("Balance load failed:", err);
    }
  };

  const ensurePoolBalance = async (walletAddress: string, requiredAmount: number) => {
    const data = await client.getBalance(walletAddress, invoiceToken);
    const available = data.available / Math.pow(10, tokenInfo.decimals);

    if (available >= requiredAmount) {
      setPoolBalance(available);
      return;
    }

    if (!sendTransaction || !signTransaction) {
      throw new Error("This wallet cannot sign transactions required for deposit.");
    }

    const unitsToDeposit = Math.ceil((requiredAmount - available) * Math.pow(10, tokenInfo.decimals));
    toast.info(`Depositing to ShadowWire pool...`, {
      description: `Depositing ${(unitsToDeposit / Math.pow(10, tokenInfo.decimals)).toFixed(4)} ${invoiceToken}`,
      duration: 10000,
    });

    const depositResp = await client.deposit({
      wallet: walletAddress,
      amount: unitsToDeposit,
    });

    const txBytes = decodeBase64ToUint8Array(depositResp.unsigned_tx_base64);
    const tx = Transaction.from(txBytes);

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
      action: { label: "View on Solscan", onClick: () => window.open(depositUrl, "_blank") },
      duration: 12000,
    });

    const confirmed = await confirmSignature(depositSig, 90_000);
    if (!confirmed) {
      throw new Error("Deposit submitted but not confirmed yet. Please retry in a moment.");
    }

    // Wait for ShadowWire to process the deposit (balance may not update immediately)
    toast.info("Waiting for pool balance to update...", { duration: 5000 });

    // Retry balance check up to 5 times with 2 second delays
    let newBalance = 0;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const data = await client.getBalance(walletAddress, invoiceToken);
        newBalance = data.available / Math.pow(10, tokenInfo.decimals);
        console.log(`[Deposit] Balance check ${i + 1}: ${newBalance} ${invoiceToken}`);
        if (newBalance >= requiredAmount) {
          setPoolBalance(newBalance);
          return;
        }
      } catch (err) {
        console.warn(`[Deposit] Balance check ${i + 1} failed:`, err);
      }
    }

    // If we get here, balance still not enough after retries
    setPoolBalance(newBalance);
    throw new Error(`Deposit confirmed but pool balance (${newBalance.toFixed(4)} ${invoiceToken}) still below required (${requiredAmount} ${invoiceToken}). Please try again.`);
  };

  useEffect(() => {
    async function init() {
      if (!isWASMSupported()) {
        setShadowWireError("WebAssembly not supported");
        return;
      }

      try {
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

  const handlePayment = async () => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Prevent double-submit - but only if the previous signature is valid
    // If previous attempt had an invalid signature, allow retry
    if (invoice.status === "pending" && invoice.transactionSignature && isValidSignature(invoice.transactionSignature)) {
      toast.info("Transaction already submitted", {
        description: `Signature: ${invoice.transactionSignature.slice(0, 8)}...${invoice.transactionSignature.slice(-8)}`,
        action: { label: "View on Solscan", onClick: () => window.open(getSolscanTxUrl(invoice.transactionSignature!), "_blank") },
        duration: 12000,
      });
      return;
    }

    // Prevent duplicate payments
    if (invoice.status === 'paid') {
      toast.error('This invoice has already been paid');
      return;
    }

    if (invoice.payerAddress === publicKey.toBase58()) {
      toast.error('You have already paid this invoice');
      return;
    }

    setIsProcessing(true);
    setShadowWireError(null);

    try {
      const sender = publicKey.toBase58();
      const recipient = invoice.recipientAddress;

      upsertInvoice(invoice);

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

      // Validate minimum amount
      if (invoice.amount < tokenInfo.minAmount) {
        toast.error(`Minimum amount is ${tokenInfo.minAmount} ${invoiceToken}`, {
          description: `ShadowWire requires at least ${tokenInfo.minAmount} ${invoiceToken} per transfer.`,
        });
        return;
      }

      // ShadowWire deducts fee from the transfer amount (recipient gets amount - fee)
      // So we only need to have the invoice amount in the pool
      console.log(`[Transfer] Amount: ${invoice.amount}, Fee: ${feeInfo.fee} (deducted from amount)`);

      // Ensure pool balance for the invoice amount
      await ensurePoolBalance(sender, invoice.amount);

      // Always use external transfer - funds go directly to recipient's wallet
      // This is better UX: recipient doesn't need to withdraw from ShadowWire pool
      const result = await client.transfer({
        sender,
        recipient,
        amount: invoice.amount,
        token: invoiceToken,
        type: "external",
        wallet: { signMessage: (m) => signMessage(m) },
      });

      // Log the full result for debugging
      console.log("[Transfer] Full result from ShadowWire:", JSON.stringify(result, null, 2));

      // Check if transfer was successful
      if (!result?.success) {
        console.error("[Transfer] ShadowWire transfer failed:", result);
        // Try to extract more info - check multiple possible error fields
        const errorInfo = (result as any)?.error
          || (result as any)?.message
          || (result as any)?.reason
          || (result as any)?.errorMessage
          || null;

        if (errorInfo) {
          throw new Error(`Transfer failed: ${errorInfo}`);
        }
        // If no error info, might be insufficient balance after deposit timing issue
        throw new Error("Transfer failed. Your pool balance may not have updated yet. Please wait a moment and try again.");
      }

      let signature = (result?.tx_signature as string | undefined) ?? "";
      if (!signature) {
        console.error("[Transfer] No signature in result:", result);
        throw new Error("ShadowWire did not return a transaction signature.");
      }

      // ShadowWire returns signatures with "TX1:" prefix for internal transfers
      // Strip the prefix to get the actual Solana signature
      if (signature.startsWith("TX1:")) {
        console.log("[Transfer] Stripping TX1: prefix from signature");
        signature = signature.substring(4);
      }

      // Validate the signature format before proceeding
      if (!isValidSignature(signature)) {
        console.error("[Transfer] Invalid signature format after processing:", signature, "Full result:", result);
        // For internal ShadowWire transfers, the "signature" might be an internal ID
        // In this case, we mark as paid but note we can't verify on-chain
        console.warn("[Transfer] This may be an internal ShadowWire transfer ID, not an on-chain signature");
        // Still allow proceeding if transfer succeeded
      }

      console.log("[Transfer] Signature to use:", signature);

      setTransactionSignature(signature);
      const txUrl = getSolscanTxUrl(signature);

      toast.success("Transfer submitted", {
        description: `Anonymous transfer • ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        action: { label: "View on Solscan", onClick: () => window.open(txUrl, "_blank") },
        duration: 10000,
      });

      // Mark pending immediately
      upsertInvoice({
        ...invoice,
        status: "pending",
        payerAddress: sender,
        transactionSignature: signature,
        paymentMethod: "shadowwire",
        isAnonymous: true, // External transfers hide sender identity
      });

      // Only confirm on-chain if we have a valid Solana signature
      // Internal ShadowWire transfers may use internal IDs that can't be verified on-chain
      let confirmed = false;
      if (isValidSignature(signature)) {
        confirmed = await confirmSignature(signature, 120_000);
        if (!confirmed) {
          toast.warning("Waiting for confirmation", {
            description: "Transfer submitted but not confirmed yet.",
            action: { label: "View on Solscan", onClick: () => window.open(txUrl, "_blank") },
            duration: 15000,
          });
          return;
        }
      } else {
        // For internal transfers without on-chain signature, trust the success response
        console.log("[Transfer] Internal transfer - trusting ShadowWire success response");
        confirmed = true;
      }

      // Mark paid
      upsertInvoice({
        ...invoice,
        status: "paid",
        payerAddress: sender,
        paidAt: new Date(),
        transactionSignature: signature,
        paymentMethod: "shadowwire",
        isAnonymous: true,
      });

      setInvoice((prev) => ({
        ...prev,
        status: "paid",
        payerAddress: sender,
        paidAt: new Date(),
        transactionSignature: signature,
        paymentMethod: "shadowwire",
        isAnonymous: true,
      }));

      setIsPaid(true);
      await loadBalance(sender);

    } catch (error: any) {
      console.error("Payment error:", error);

      if (error instanceof RecipientNotFoundError) {
        setShadowWireError("Recipient not found. Using external transfer.");
      } else if (error instanceof InsufficientBalanceError) {
        setShadowWireError("Insufficient ShadowWire balance.");
      } else {
        setShadowWireError("Transfer failed: " + (error?.message ?? String(error)));
      }

      toast.error("Transfer failed", { description: error?.message ?? "Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  // PAID STATE
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

        {invoice.paymentMethod && (
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono ${
              invoice.isAnonymous ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {invoice.isAnonymous ? (
                <><EyeOff className="h-4 w-4" /> Anonymous Payment</>
              ) : (
                <><Shield className="h-4 w-4" /> Private Payment</>
              )}
            </span>
          </div>
        )}

        <p className="text-muted-foreground mb-4">
          {invoice.isAnonymous
            ? 'Paid anonymously via ShadowWire. Your identity is protected.'
            : 'Paid privately via ShadowWire with hidden transaction amount.'}
        </p>

        {invoice.payerAddress && !invoice.isAnonymous && (
          <p className="text-sm text-muted-foreground mb-2 font-mono">
            Paid by: {invoice.payerAddress.slice(0, 8)}...{invoice.payerAddress.slice(-6)}
          </p>
        )}

        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-mono mt-4">
            View transaction on Solscan <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </motion.div>
    );
  }

  // EXPIRED STATE
  if (invoice.status === 'expired') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="font-mono text-2xl font-bold text-destructive mb-2">Invoice Expired</h3>
        <p className="text-muted-foreground">This invoice is no longer valid.</p>
      </motion.div>
    );
  }

  // PAYMENT FORM
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="glass-card-glow p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold">Pay Invoice</h2>
          <p className="text-sm text-muted-foreground">Private payment via ShadowWire</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground font-mono mb-1">Amount to pay</p>
          <p className="text-3xl font-bold font-mono text-gradient">
            {invoice.amount} <span className="text-lg">{invoiceToken}</span>
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
          <p className="font-mono text-sm truncate text-foreground/80">{invoice.recipientAddress}</p>
        </div>

        {/* Auto-verification indicator - shows for anyone viewing pending invoice */}
        {invoice.status === 'pending' && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 text-blue-400 ${isVerifyingPayment ? 'animate-spin' : ''}`} />
              <p className="text-sm font-mono text-blue-400">
                {isVerifyingPayment ? 'Checking for payment...' : 'Monitoring for incoming payment'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This page will automatically update when payment is received.
            </p>
          </div>
        )}
      </div>

      {!wasmInitialized && !shadowWireError ? (
        <div className="p-6 rounded-lg bg-primary/10 border border-primary/20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <h3 className="font-mono text-lg font-bold mb-2">Initializing ShadowWire...</h3>
          <p className="text-sm text-muted-foreground">Preparing zero-knowledge proof system.</p>
        </div>
      ) : !connected ? (
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Connect your wallet to pay</p>
          <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-12 !px-8 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all !mx-auto" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Anonymous Transfer Info */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <EyeOff className="h-4 w-4 text-primary" />
              <p className="text-sm font-mono font-medium text-primary">Anonymous Payment</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Your identity is hidden. Funds go directly to recipient's wallet.
            </p>
          </div>

          {/* ShadowWire Balance & Fee Info */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground font-mono">ShadowWire Balance</p>
                <p className={`font-mono text-sm ${(poolBalance ?? 0) === 0 ? 'text-yellow-400' : 'text-foreground'}`}>
                  {poolBalance?.toFixed(4) ?? "0.0000"} {invoiceToken}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono">Fee ({feeInfo.feePercent}%)</p>
                <p className="font-mono text-sm text-foreground">{feeInfo.fee.toFixed(4)} {invoiceToken}</p>
              </div>
            </div>

            {(poolBalance ?? 0) < invoice.amount && (
              <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-400 font-mono text-center mb-1">
                  <AlertCircle className="h-3 w-3 inline mr-1" /> Deposit Required
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Auto-deposits to ShadowWire pool when you click Pay.
                </p>
              </div>
            )}

            {feeInfo.isBelowMin && (
              <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-destructive font-mono text-center">
                  <AlertCircle className="h-3 w-3 inline mr-1" /> Minimum: {feeInfo.minAmount} {invoiceToken}
                </p>
              </div>
            )}

            <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground text-center">
                <Info className="h-3 w-3 inline mr-1" />
                Min {tokenInfo.minAmount} {invoiceToken} • {tokenInfo.feePercent}% fee • Solana Mainnet
              </p>
            </div>
          </div>

          {shadowWireError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-mono text-destructive text-center">{shadowWireError}</p>
            </div>
          )}

          <Button variant="glow" size="lg" className="w-full group" onClick={handlePayment}
            disabled={isProcessing || !wasmInitialized || feeInfo.isBelowMin}>
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
            ) : (
              <>Pay {invoice.amount} {invoiceToken} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></>
            )}
          </Button>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs text-muted-foreground text-center">
          ShadowWire private transfer on Solana Mainnet
        </p>
      </div>
    </motion.div>
  );
}
