import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { CreateInvoiceForm } from '@/components/CreateInvoiceForm';
import { Wallet } from 'lucide-react';

const CreateInvoice = () => {
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          <div className="text-center mb-8">
            <h1 className="font-mono text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient">Create Invoice</span>
            </h1>
            <p className="text-muted-foreground">
              Request payment in SOL with a shareable link
            </p>
          </div>

          {connected ? (
            <CreateInvoiceForm />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card-glow p-12 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-mono text-xl font-bold mb-3">Connect Your Wallet</h2>
              <p className="text-muted-foreground mb-6">
                Connect your Solana wallet to create invoices and receive payments.
              </p>
              <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-12 !px-8 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all !mx-auto" />
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default CreateInvoice;
