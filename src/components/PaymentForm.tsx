import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Invoice, useInvoices } from '@/contexts/InvoiceContext';
import { Wallet, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  invoice: Invoice;
}

export function PaymentForm({ invoice }: PaymentFormProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { updateInvoiceStatus } = useInvoices();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(invoice.status === 'paid');

  const handlePayment = async () => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);

    try {
      const recipientPubkey = new PublicKey(invoice.recipientAddress);
      const lamports = Math.round(invoice.amount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      updateInvoiceStatus(invoice.id, 'paid', publicKey.toBase58());
      setIsPaid(true);
      toast.success('Payment successful!');
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
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
        <p className="text-muted-foreground">
          This invoice has been paid successfully.
        </p>
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

      {!connected ? (
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Connect your wallet to pay</p>
          <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-12 !px-8 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all !mx-auto" />
        </div>
      ) : (
        <Button
          variant="glow"
          size="lg"
          className="w-full group"
          onClick={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Pay {invoice.amount} SOL
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center mt-4">
        Payment will be sent on Solana Devnet
      </p>
    </motion.div>
  );
}
