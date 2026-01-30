import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useInvoices, InvoiceToken } from '@/contexts/InvoiceContext';
import { FileText, ArrowRight, Loader2, Shield, Info } from 'lucide-react';
import { toast } from 'sonner';

// Token configuration for ShadowWire
const TOKEN_CONFIG: Record<InvoiceToken, { name: string; min: number; fee: number }> = {
  SOL: { name: 'Solana', min: 0.1, fee: 0.5 },
  USD1: { name: 'USD1 Stablecoin', min: 1, fee: 0.3 },
};

export function CreateInvoiceForm() {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<InvoiceToken>('SOL');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const tokenConfig = TOKEN_CONFIG[token];
  const amountNum = parseFloat(amount) || 0;
  const isBelowMin = amountNum > 0 && amountNum < tokenConfig.min;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amount || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amountNum < tokenConfig.min) {
      toast.error(`Minimum amount is ${tokenConfig.min} ${token}`, {
        description: 'ShadowWire requires minimum amounts for private transfers.',
      });
      return;
    }

    setIsCreating(true);

    try {
      const invoice = createInvoice(
        amountNum,
        token,
        description || 'Payment request',
        publicKey.toBase58()
      );

      toast.success('Invoice created successfully!', {
        description: `${amountNum} ${token} invoice ready to share.`,
      });
      navigate(`/invoice/${invoice.id}`);
    } catch (error) {
      toast.error('Failed to create invoice');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card-glow p-8 max-w-lg mx-auto"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold">Create Invoice</h2>
          <p className="text-sm text-muted-foreground">Request private payment</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Token Selection */}
        <div className="space-y-2">
          <Label className="font-mono text-sm">Token</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={token === 'SOL' ? 'glow' : 'glass'}
              className="flex-1"
              onClick={() => setToken('SOL')}
            >
              SOL
            </Button>
            <Button
              type="button"
              variant={token === 'USD1' ? 'glow' : 'glass'}
              className="flex-1"
              onClick={() => setToken('USD1')}
            >
              USD1
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            {token === 'USD1' ? 'USD1 stablecoin for stable payments' : 'Native SOL token'}
          </p>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="font-mono text-sm">
            Amount ({token})
          </Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              step={token === 'SOL' ? '0.001' : '0.01'}
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono text-lg h-12 pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
              {token}
            </span>
          </div>
          {isBelowMin && (
            <p className="text-xs text-destructive">
              Minimum: {tokenConfig.min} {token} for ShadowWire transfers
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="font-mono text-sm">
            Description (optional)
          </Label>
          <Textarea
            id="description"
            placeholder="What's this payment for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-secondary/50 border-border/50 focus:border-primary/50 min-h-[100px] resize-none"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground text-right">
            {description.length}/200
          </p>
        </div>

        {/* Receiving Wallet */}
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground font-mono mb-1">Receiving wallet</p>
          <p className="font-mono text-sm truncate text-foreground">
            {publicKey?.toBase58() || 'Connect wallet to continue'}
          </p>
        </div>

        {/* ShadowWire Info */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-primary mt-0.5" />
            <div>
              <p className="text-xs font-mono text-primary mb-1">Privacy-First Payments</p>
              <p className="text-xs text-muted-foreground">
                Payers can use ShadowWire for private or anonymous transfers.
                Min {tokenConfig.min} {token} • {tokenConfig.fee}% fee • Mainnet only
              </p>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          variant="glow"
          size="lg"
          className="w-full group"
          disabled={!publicKey || isCreating || isBelowMin}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Generate Invoice
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}
