import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Invoice } from '@/contexts/InvoiceContext';
import { 
  Copy, 
  Check, 
  Share2, 
  MessageCircle, 
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceCardProps {
  invoice: Invoice;
  showActions?: boolean;
}

export function InvoiceCard({ invoice, showActions = true }: InvoiceCardProps) {
  const [copied, setCopied] = useState(false);
  
  // Include invoice data in URL query parameters so it can be accessed by anyone with the link
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-mono">
            <Clock className="h-3.5 w-3.5" />
            Pending
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
                {invoice.payerAddress}
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
                href={`https://solscan.io/tx/${invoice.transactionSignature}?cluster=testnet`}
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
                href={`https://solscan.io/tx/${invoice.transactionSignature}?cluster=testnet`}
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

      {/* Actions */}
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
