import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { PaymentForm } from '@/components/PaymentForm';
import { useInvoices } from '@/contexts/InvoiceContext';
import { Button } from '@/components/ui/button';
import { FileX, Home } from 'lucide-react';
import { Logo } from '@/components/Logo';

const PayInvoice = () => {
  const { id } = useParams<{ id: string }>();
  const { getInvoice } = useInvoices();
  
  const invoice = id ? getInvoice(id) : undefined;

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
                  You've received a payment request
                </p>
              </div>
              <PaymentForm invoice={invoice} />
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
