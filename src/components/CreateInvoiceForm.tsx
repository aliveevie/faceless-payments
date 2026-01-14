import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useInvoices } from '@/contexts/InvoiceContext';
import { FileText, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function CreateInvoiceForm() {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const { createInvoice } = useInvoices();
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsCreating(true);
    
    try {
      const invoice = createInvoice(
        parseFloat(amount),
        description || 'Payment request',
        publicKey.toBase58()
      );
      
      toast.success('Invoice created successfully!');
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
          <p className="text-sm text-muted-foreground">Request payment in SOL</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="amount" className="font-mono text-sm">
            Amount (SOL)
          </Label>
          <div className="relative">
            <Input
              id="amount"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-secondary/50 border-border/50 focus:border-primary/50 font-mono text-lg h-12 pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">
              SOL
            </span>
          </div>
        </div>

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

        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground font-mono mb-1">Receiving wallet</p>
          <p className="font-mono text-sm truncate text-foreground">
            {publicKey?.toBase58() || 'Connect wallet to continue'}
          </p>
        </div>

        <Button 
          type="submit" 
          variant="glow" 
          size="lg" 
          className="w-full group"
          disabled={!publicKey || isCreating}
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
