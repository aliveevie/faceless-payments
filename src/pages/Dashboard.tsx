import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { InvoiceList } from '@/components/InvoiceList';
import { ShadowWirePool } from '@/components/ShadowWirePool';
import { useInvoices, InvoiceToken } from '@/contexts/InvoiceContext';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, FileText, Clock, ArrowUpRight, ArrowDownRight, Shield } from 'lucide-react';

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

  // Stats for received invoices
  const pendingCount = receivedInvoices.filter(inv => inv.status === 'pending').length;
  const paidReceivedCount = receivedInvoices.filter(inv => inv.status === 'paid').length;

  // Calculate totals by token
  const calculateTotalByToken = (invs: typeof invoices, token: InvoiceToken) => {
    return invs
      .filter(inv => inv.status === 'paid' && (inv.token || 'SOL') === token)
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
  };

  const receivedSOL = calculateTotalByToken(receivedInvoices, 'SOL');
  const receivedUSD1 = calculateTotalByToken(receivedInvoices, 'USD1');
  const paidSOL = calculateTotalByToken(paidInvoices, 'SOL');
  const paidUSD1 = calculateTotalByToken(paidInvoices, 'USD1');

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
              <p className="text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Privacy-first invoices on Solana Mainnet
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
              {/* ShadowWire Pool - Withdraw funds */}
              <ShadowWirePool />

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
                  <div className="space-y-1">
                    {receivedSOL > 0 && (
                      <p className="text-2xl font-bold font-mono text-green-400">
                        {receivedSOL.toFixed(2)} <span className="text-sm">SOL</span>
                      </p>
                    )}
                    {receivedUSD1 > 0 && (
                      <p className="text-2xl font-bold font-mono text-green-400">
                        {receivedUSD1.toFixed(2)} <span className="text-sm">USD1</span>
                      </p>
                    )}
                    {receivedSOL === 0 && receivedUSD1 === 0 && (
                      <p className="text-2xl font-bold font-mono text-green-400">0.00</p>
                    )}
                  </div>
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
                  <div className="space-y-1">
                    {paidSOL > 0 && (
                      <p className="text-2xl font-bold font-mono text-blue-400">
                        {paidSOL.toFixed(2)} <span className="text-sm">SOL</span>
                      </p>
                    )}
                    {paidUSD1 > 0 && (
                      <p className="text-2xl font-bold font-mono text-blue-400">
                        {paidUSD1.toFixed(2)} <span className="text-sm">USD1</span>
                      </p>
                    )}
                    {paidSOL === 0 && paidUSD1 === 0 && (
                      <p className="text-2xl font-bold font-mono text-blue-400">0.00</p>
                    )}
                  </div>
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
                Connect your Solana wallet to create private invoices and track payments.
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
