import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Invoice } from '@/contexts/InvoiceContext';
import { Button } from './ui/button';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  FileText 
} from 'lucide-react';
import { getSolscanTxUrl } from '@/lib/solana';

interface InvoiceListProps {
  invoices: Invoice[];
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-primary" />;
    }
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'paid':
        return 'text-green-400';
      case 'expired':
        return 'text-destructive';
      default:
        return 'text-primary';
    }
  };

  if (invoices.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-mono text-lg font-semibold mb-2">No invoices yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first invoice to start receiving payments.
        </p>
        <Link to="/create">
          <Button variant="glow">Create Invoice</Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice, index) => (
        <motion.div
          key={invoice.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="glass-card p-4 hover:border-primary/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {getStatusIcon(invoice.status)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-lg">
                    {invoice.amount} SOL
                  </span>
                  <span className={`text-xs font-mono capitalize ${getStatusColor(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {invoice.description || 'Payment request'}
                </p>
                {invoice.status === 'paid' && invoice.payerAddress && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Paid by: {invoice.isAnonymous ? 'Anonymous' : `${invoice.payerAddress.slice(0, 8)}...${invoice.payerAddress.slice(-6)}`}
                  </p>
                )}
                {invoice.status === 'paid' && invoice.transactionSignature && (
                  <a
                    href={getSolscanTxUrl(invoice.transactionSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-1 inline-block font-mono"
                  >
                    TX: {invoice.transactionSignature.slice(0, 8)}...{invoice.transactionSignature.slice(-6)}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {invoice.createdAt.toLocaleDateString()}
              </span>
              <Link to={`/invoice/${invoice.id}`}>
                <Button variant="ghost" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
