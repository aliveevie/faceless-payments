import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { InvoiceList } from '@/components/InvoiceList';
import { useInvoices } from '@/contexts/InvoiceContext';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, FileText, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const Dashboard = () => {
  const { connected, publicKey } = useWallet();
  const { invoices } = useInvoices();

  // Invoices where current user is the recipient (payments received)
  const receivedInvoices = connected && publicKey 
    ? invoices.filter(inv => inv.recipientAddress === publicKey.toBase58())
    : [];

  // Invoices where current user is the payer (payments made)
  const paidInvoices = connected && publicKey 
    ? invoices.filter(inv => inv.payerAddress === publicKey.toBase58() && inv.status === 'paid')
    : [];

  // Debug logging
  console.log('Dashboard - Total invoices:', invoices.length);
  console.log('Dashboard - Received invoices:', receivedInvoices);
  console.log('Dashboard - Paid invoices:', paidInvoices);

  // Stats for received invoices
  const pendingCount = receivedInvoices.filter(inv => inv.status === 'pending').length;
  const paidReceivedCount = receivedInvoices.filter(inv => inv.status === 'paid').length;
  const totalReceived = receivedInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Stats for payments made
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="font-mono text-3xl md:text-4xl font-bold mb-2">
                <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-muted-foreground">
                Manage your invoices and track payments
              </p>
            </div>
            
            {connected && (
              <Link to="/create">
                <Button variant="glow" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Invoice
                </Button>
              </Link>
            )}
          </div>

          {connected ? (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-mono">Total Invoices</span>
                  </div>
                  <p className="text-3xl font-bold font-mono">{receivedInvoices.length}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground font-mono">Pending</span>
                  </div>
                  <p className="text-3xl font-bold font-mono text-primary">{pendingCount}</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowDownRight className="h-5 w-5 text-green-400" />
                    <span className="text-sm text-muted-foreground font-mono">Received</span>
                  </div>
                  <p className="text-3xl font-bold font-mono text-green-400">
                    {totalReceived.toFixed(2)} <span className="text-lg">SOL</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ArrowUpRight className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-muted-foreground font-mono">Paid</span>
                  </div>
                  <p className="text-3xl font-bold font-mono text-blue-400">
                    {totalPaid.toFixed(2)} <span className="text-lg">SOL</span>
                  </p>
                </motion.div>
              </div>

              {/* Payments Received Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ArrowDownRight className="h-5 w-5 text-green-400" />
                  <h2 className="font-mono text-xl font-bold">Payments Received</h2>
                  <span className="text-sm text-muted-foreground">
                    ({paidReceivedCount} paid, {pendingCount} pending)
                  </span>
                </div>
                <InvoiceList invoices={receivedInvoices} />
              </motion.div>

              {/* Payments Made Section */}
              {paidInvoices.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <ArrowUpRight className="h-5 w-5 text-blue-400" />
                    <h2 className="font-mono text-xl font-bold">Payments Made</h2>
                    <span className="text-sm text-muted-foreground">
                      ({paidInvoices.length} invoices)
                    </span>
                  </div>
                  <InvoiceList invoices={paidInvoices} />
                </motion.div>
              )}
            </>
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
                Connect your Solana wallet to view your invoices and track payments.
              </p>
              <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-12 !px-8 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all !mx-auto" />
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
