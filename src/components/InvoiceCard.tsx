import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Invoice, useInvoices } from '@/contexts/InvoiceContext';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  Copy,
  Check,
  Share2,
  MessageCircle,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { getSolscanTxUrl } from '@/lib/solana';

interface InvoiceCardProps {
  invoice: Invoice;
  showActions?: boolean;
}

// Devnet RPC for verification
const DEVNET_RPC = 'https://api.devnet.solana.com';
const POLL_INTERVAL = 5000; // Check every 5 seconds

export function InvoiceCard({ invoice: initialInvoice, showActions = true }: InvoiceCardProps) {
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { upsertInvoice, invoices } = useInvoices();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckedSigRef = useRef<string | null>(null);

  // Get latest invoice from context
  const invoice = invoices.find(inv => inv.id === initialInvoice.id) || initialInvoice;

  // Include invoice data in URL query parameters
  const invoiceUrl = `${window.location.origin}/pay/${invoice.id}?amount=${invoice.amount}&description=${encodeURIComponent(invoice.description || '')}&recipient=${encodeURIComponent(invoice.recipientAddress)}`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToTelegram = () => {
    const text = `💸 Payment Request: ${invoice.amount} SOL\n${invoice.description}\n\nPay here: ${invoiceUrl}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(invoiceUrl)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToWhatsApp = () => {
    const text = `💸 Payment Request: ${invoice.amount} SOL\n${invoice.description}\n\nPay here: ${invoiceUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Check blockchain for payment
  const checkForPayment = async (): Promise<boolean> => {
    try {
      const connection = new Connection(DEVNET_RPC, 'confirmed');
      const recipientPubkey = new PublicKey(invoice.recipientAddress);

      // Get recent signatures
      const signatures = await connection.getSignaturesForAddress(recipientPubkey, { limit: 10 });

      if (signatures.length === 0) return false;

      // Skip if we already checked this signature
      if (lastCheckedSigRef.current === signatures[0].signature) {
        return false;
      }

      const invoiceLamports = Math.round(invoice.amount * LAMPORTS_PER_SOL);
      const tolerance = 10000; // Allow small differences

      for (const sig of signatures) {
        // Skip already checked
        if (sig.signature === lastCheckedSigRef.current) break;

        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx || !tx.meta) continue;

          const preBalances = tx.meta.preBalances;
          const postBalances = tx.meta.postBalances;
          const accountKeys = tx.transaction.message.getAccountKeys();

          // Find recipient account
          let recipientIndex = -1;
          for (let i = 0; i < accountKeys.length; i++) {
            if (accountKeys.get(i)?.toBase58() === invoice.recipientAddress) {
              recipientIndex = i;
              break;
            }
          }

          if (recipientIndex === -1) continue;

          const amountReceived = postBalances[recipientIndex] - preBalances[recipientIndex];

          // Check if amount matches
          if (Math.abs(amountReceived - invoiceLamports) <= tolerance) {
            // Found payment!
            const senderIndex = preBalances.findIndex((pre, i) =>
              i !== recipientIndex && pre > postBalances[i]
            );

            const senderAddress = senderIndex >= 0
              ? accountKeys.get(senderIndex)?.toBase58()
              : undefined;

            // Update invoice
            upsertInvoice({
              ...invoice,
              status: 'paid',
              payerAddress: senderAddress,
              transactionSignature: sig.signature,
              paidAt: new Date(sig.blockTime ? sig.blockTime * 1000 : Date.now()),
              paymentMethod: 'normal',
            });

            toast.success('Payment received!', {
              description: `${invoice.amount} SOL confirmed on blockchain`,
              action: {
                label: 'View',
                onClick: () => window.open(getSolscanTxUrl(sig.signature), '_blank'),
              },
            });

            return true;
          }
        } catch (err) {
          console.warn('Error checking tx:', err);
        }
      }

      // Update last checked
      lastCheckedSigRef.current = signatures[0].signature;
      return false;

    } catch (err) {
      console.warn('Payment check error:', err);
      return false;
    }
  };

  // Auto-poll for payments when invoice is pending
  useEffect(() => {
    if (invoice.status !== 'pending') {
      // Clear polling if not pending
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Start polling
    const poll = async () => {
      setIsChecking(true);
      const found = await checkForPayment();
      setIsChecking(false);

      if (found && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    // Initial check
    poll();

    // Set up interval
    pollingRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [invoice.status, invoice.id, invoice.amount, invoice.recipientAddress]);

  const getStatusBadge = () => {
    switch (invoice.status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-mono">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/20 text-destructive text-sm font-mono">
            <XCircle className="h-3.5 w-3.5" />
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-mono">
            {isChecking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5 animate-pulse" />
            )}
            Awaiting Payment
          </span>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-card-glow p-6 md:p-8"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-mono text-lg font-semibold">Invoice</h2>
        {getStatusBadge()}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* QR Code */}
        <div className="flex-shrink-0">
          <div className="p-4 bg-white rounded-xl">
            <QRCodeSVG
              value={invoiceUrl}
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Invoice Details */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground font-mono mb-1">Amount</p>
            <p className="text-4xl font-bold font-mono text-gradient">
              {invoice.amount} <span className="text-xl">SOL</span>
            </p>
          </div>

          {invoice.description && (
            <div>
              <p className="text-sm text-muted-foreground font-mono mb-1">Description</p>
              <p className="text-foreground">{invoice.description}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground font-mono mb-1">Recipient</p>
            <p className="font-mono text-sm truncate text-foreground/80">
              {invoice.recipientAddress}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground font-mono mb-1">Created</p>
            <p className="text-sm text-foreground/80">
              {invoice.createdAt.toLocaleString()}
            </p>
          </div>

          {invoice.status === 'paid' && invoice.payerAddress && (
            <div>
              <p className="text-sm text-muted-foreground font-mono mb-1">Paid by</p>
              <p className="font-mono text-sm truncate text-green-400">
                {invoice.isAnonymous ? 'Anonymous' : invoice.payerAddress}
              </p>
            </div>
          )}

          {invoice.status === 'paid' && invoice.paidAt && (
            <div>
              <p className="text-sm text-muted-foreground font-mono mb-1">Paid at</p>
              <p className="text-sm text-foreground/80">
                {invoice.paidAt.toLocaleString()}
              </p>
            </div>
          )}

          {invoice.status === 'paid' && invoice.transactionSignature && (
            <div>
              <p className="text-sm text-muted-foreground font-mono mb-1">Transaction</p>
              <a
                href={getSolscanTxUrl(invoice.transactionSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                {invoice.transactionSignature.slice(0, 16)}...{invoice.transactionSignature.slice(-8)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Live Monitoring Banner for Pending */}
      {invoice.status === 'pending' && (
        <div className="mt-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio className="h-4 w-4 text-yellow-400" />
              <span className="absolute inset-0 animate-ping">
                <Radio className="h-4 w-4 text-yellow-400 opacity-75" />
              </span>
            </div>
            <p className="text-sm text-yellow-400 font-mono">
              Monitoring blockchain for payment...
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            Will update automatically when payment is detected
          </p>
        </div>
      )}

      {/* Paid Status Message */}
      {invoice.status === 'paid' && (
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <h3 className="font-mono font-bold text-green-400">Payment Complete</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              This invoice has been paid successfully. The payment has been confirmed on the blockchain.
            </p>
            {invoice.transactionSignature && (
              <a
                href={getSolscanTxUrl(invoice.transactionSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-mono"
              >
                View transaction on Solscan
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Actions for Pending Invoices */}
      {showActions && invoice.status === 'pending' && (
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="glow"
              onClick={copyToClipboard}
              className="flex-1 min-w-[140px]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>

            <Button
              variant="glass"
              onClick={shareToTelegram}
              className="flex-1 min-w-[140px]"
            >
              <MessageCircle className="h-4 w-4" />
              Telegram
            </Button>

            <Button
              variant="glass"
              onClick={shareToWhatsApp}
              className="flex-1 min-w-[140px]"
            >
              <Share2 className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-xs text-muted-foreground font-mono mb-1">Share this link</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm truncate flex-1 text-foreground/80">
                {invoiceUrl}
              </p>
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
              </a>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
