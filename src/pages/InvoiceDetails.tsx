import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { InvoiceCard } from '@/components/InvoiceCard';
import { PaymentForm } from '@/components/PaymentForm';
import { useInvoices, Invoice } from '@/contexts/InvoiceContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileX } from 'lucide-react';

const InvoiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { getInvoice, invoices } = useInvoices();
  const [invoice, setInvoice] = useState<Invoice | undefined>(undefined);
  
  // Watch for invoice updates in context
  useEffect(() => {
    if (id) {
      const foundInvoice = getInvoice(id);
      if (foundInvoice) {
        setInvoice(foundInvoice);
      }
    }
  }, [id, getInvoice, invoices]); // Re-run when invoices change

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <Link to="/dashboard" className="inline-flex mb-6">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          {invoice ? (
            <>
              <InvoiceCard invoice={invoice} showActions={true} />
              {invoice.status === 'pending' && (
                <div className="mt-6">
                  <PaymentForm invoice={invoice} />
                </div>
              )}
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
              <Link to="/dashboard">
                <Button variant="glow">Go to Dashboard</Button>
              </Link>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default InvoiceDetails;
