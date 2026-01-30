import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { PaymentForm } from '@/components/PaymentForm';
import { useInvoices, Invoice } from '@/contexts/InvoiceContext';
import { Button } from '@/components/ui/button';
import { FileX, Home } from 'lucide-react';
import { Logo } from '@/components/Logo';

const PayInvoice = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { getInvoice, invoices, ensureInvoice } = useInvoices();
  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  
  // Update invoice when context changes (after payment)
  useEffect(() => {
    if (id) {
      // Always check invoices array first (most up-to-date)
      let foundInvoice = invoices.find(inv => inv.id === id);
      
      if (foundInvoice) {
        // Invoice exists in context - use it
        console.log('Found invoice in context:', foundInvoice);
        setInvoice(foundInvoice);
      } else {
        // If not found in context, try to reconstruct from URL query parameters
        const amount = searchParams.get('amount');
        const token = searchParams.get('token') as 'SOL' | 'USD1' | null;
        const description = searchParams.get('description');
        const recipient = searchParams.get('recipient');
        // Payment info (included in share URL after payment)
        const status = searchParams.get('status') as 'pending' | 'paid' | null;
        const txSig = searchParams.get('txSig');
        const payer = searchParams.get('payer');

        if (amount && recipient) {
          // Reconstruct invoice from URL parameters
          const tempInvoice: Invoice = {
            id: id,
            amount: parseFloat(amount),
            token: token || 'SOL',
            description: description || 'Payment request',
            recipientAddress: recipient,
            createdAt: new Date(),
            status: status === 'paid' ? 'paid' : 'pending',
            // Include payment info if available from URL
            transactionSignature: txSig || undefined,
            payerAddress: payer || undefined,
            paidAt: status === 'paid' ? new Date() : undefined,
            isAnonymous: status === 'paid' && !payer, // Anonymous if paid but no payer shown
          };

          // CRITICAL: Ensure invoice exists in context so it can be updated when paid
          foundInvoice = ensureInvoice(tempInvoice);
          setInvoice(foundInvoice);
        }
      }
    }
  }, [id, getInvoice, searchParams, invoices, ensureInvoice]); // Re-run when invoices change

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto"
        >
          {invoice ? (
            <>
              <div className="text-center mb-8">
                <Logo size="lg" />
                <p className="text-muted-foreground mt-4">
                  {invoice.status === 'paid' 
                    ? 'Payment request has been paid' 
                    : 'You\'ve received a payment request'}
                </p>
              </div>
              <PaymentForm invoice={invoice} key={invoice.id} />
            </>
          ) : (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <FileX className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="font-mono text-xl font-bold mb-2">Invoice Not Found</h2>
              <p className="text-muted-foreground mb-6">
                This invoice doesn't exist or has been removed.
              </p>
              <Link to="/">
                <Button variant="glow" className="gap-2">
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default PayInvoice;
