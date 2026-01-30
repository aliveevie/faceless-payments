import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Invoice, useInvoices } from '@/contexts/InvoiceContext';
import {
  Copy,
  Check,
  Share2,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Radio,
  Shield,
  EyeOff,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { getSolscanTxUrl } from '@/lib/solana';

interface InvoiceCardProps {
  invoice: Invoice;
  showActions?: boolean;
}

export function InvoiceCard({ invoice: initialInvoice, showActions = true }: InvoiceCardProps) {
  const [copied, setCopied] = useState(false);
  const { invoices } = useInvoices();

  // Get latest invoice from context
  const invoice = invoices.find(inv => inv.id === initialInvoice.id) || initialInvoice;

  // Invoice token (SOL or USD1)
  const invoiceToken = invoice.token || 'SOL';

  // Include invoice data in URL query parameters
  // When paid, include payment info so recipient can see the paid status
  const baseUrl = `${window.location.origin}/pay/${invoice.id}?amount=${invoice.amount}&token=${invoiceToken}&description=${encodeURIComponent(invoice.description || '')}&recipient=${encodeURIComponent(invoice.recipientAddress)}`;
  const paymentParams = invoice.status === 'paid'
    ? `&status=paid${invoice.transactionSignature ? `&txSig=${invoice.transactionSignature}` : ''}${invoice.payerAddress && !invoice.isAnonymous ? `&payer=${invoice.payerAddress}` : ''}`
    : '';
  const invoiceUrl = baseUrl + paymentParams;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToTelegram = () => {
    const text = `💸 Payment Request: ${invoice.amount} ${invoiceToken}\n${invoice.description}\n\nPay here: ${invoiceUrl}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(invoiceUrl)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareToWhatsApp = () => {
    const text = `💸 Payment Request: ${invoice.amount} ${invoiceToken}\n${invoice.description}\n\nPay here: ${invoiceUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

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
            <Radio className="h-3.5 w-3.5 animate-pulse" />
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
              {invoice.amount} <span className="text-xl">{invoiceToken}</span>
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

          {invoice.status === 'paid' && invoice.paymentMethod && (
            <div>
              <p className="text-sm text-muted-foreground font-mono mb-1">Payment Method</p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono ${
                invoice.paymentMethod === 'shadowwire'
                  ? invoice.isAnonymous
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {invoice.paymentMethod === 'shadowwire' ? (
                  invoice.isAnonymous ? (
                    <><EyeOff className="h-3 w-3" /> Anonymous (ShadowWire)</>
                  ) : (
                    <><Shield className="h-3 w-3" /> Private (ShadowWire)</>
                  )
                ) : (
                  <><Zap className="h-3 w-3" /> Normal Transfer</>
                )}
              </span>
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

      {/* Pending Status Message */}
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
              Awaiting payment...
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            Share this invoice link. Payment will update automatically.
          </p>
        </div>
      )}

      {/* Paid Status Message */}
      {invoice.status === 'paid' && (
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <h3 className="font-mono font-bold text-green-400">Payment Complete</h3>
              </div>
              {invoice.paymentMethod === 'shadowwire' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${
                  invoice.isAnonymous
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {invoice.isAnonymous ? (
                    <><EyeOff className="h-3 w-3" /> Anonymous</>
                  ) : (
                    <><Shield className="h-3 w-3" /> Private</>
                  )}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {invoice.paymentMethod === 'shadowwire' ? (
                invoice.isAnonymous
                  ? 'This payment was made anonymously using ShadowWire.'
                  : 'This payment was made privately with hidden amount via ShadowWire.'
              ) : (
                'This invoice has been paid and confirmed on Solana mainnet.'
              )}
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
