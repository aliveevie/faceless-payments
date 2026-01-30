import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Supported tokens for Faceless Payments
export type InvoiceToken = 'SOL' | 'USD1';

export interface Invoice {
  id: string;
  amount: number;
  token: InvoiceToken; // SOL or USD1
  description: string;
  recipientAddress: string;
  createdAt: Date;
  status: 'pending' | 'paid' | 'expired';
  payerAddress?: string;
  paidAt?: Date;
  expiresAt?: Date;
  transactionSignature?: string; // Transaction signature for tracking payments
  // Optional payment UX flags
  isAnonymous?: boolean; // If true, hide payer in UI for recipient-side displays
  paymentMethod?: 'normal' | 'shadowwire';
}

interface InvoiceContextType {
  invoices: Invoice[];
  createInvoice: (amount: number, token: InvoiceToken, description: string, recipientAddress: string) => Invoice;
  getInvoice: (id: string) => Invoice | undefined;
  updateInvoiceStatus: (id: string, status: Invoice['status'], payerAddress?: string, transactionSignature?: string) => void;
  upsertInvoice: (invoice: Invoice) => void;
  ensureInvoice: (invoice: Invoice) => Invoice; // Ensure invoice exists in context
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

const STORAGE_KEY = 'faceless_invoices';

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((inv: any) => ({
        ...inv,
        amount: typeof inv.amount === 'number' ? inv.amount : parseFloat(inv.amount) || 0,
        token: inv.token || 'SOL', // Default to SOL for legacy invoices
        createdAt: new Date(inv.createdAt),
        paidAt: inv.paidAt ? new Date(inv.paidAt) : undefined,
        expiresAt: inv.expiresAt ? new Date(inv.expiresAt) : undefined,
      }));
    }
    return [];
  });

  useEffect(() => {
    try {
      const invoicesToStore = invoices.map(inv => ({
        ...inv,
        createdAt: inv.createdAt.toISOString(),
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : undefined,
        expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoicesToStore));
      console.log('Invoices saved to localStorage:', invoicesToStore.length);
    } catch (error) {
      console.error('Error saving invoices to localStorage:', error);
    }
  }, [invoices]);

  const createInvoice = (amount: number, token: InvoiceToken, description: string, recipientAddress: string): Invoice => {
    const newInvoice: Invoice = {
      id: uuidv4(),
      amount,
      token,
      description,
      recipientAddress,
      createdAt: new Date(),
      status: 'pending',
    };

    setInvoices(prev => [newInvoice, ...prev]);
    return newInvoice;
  };

  const getInvoice = (id: string): Invoice | undefined => {
    return invoices.find(inv => inv.id === id);
  };

  const updateInvoiceStatus = (id: string, status: Invoice['status'], payerAddress?: string, transactionSignature?: string) => {
    console.log('Updating invoice status:', { id, status, payerAddress, transactionSignature });
    
    setInvoices(prev => {
      const invoiceIndex = prev.findIndex(inv => inv.id === id);
      
      if (invoiceIndex === -1) {
        console.error(`Invoice ${id} not found in context. Cannot update.`);
        console.log('Available invoice IDs:', prev.map(inv => inv.id));
        return prev; // Don't update if invoice doesn't exist
      }
      
      const updated = [...prev]; // Create new array
      const existingInvoice = updated[invoiceIndex];
      
      // Update the invoice
      updated[invoiceIndex] = {
        ...existingInvoice,
        status,
        payerAddress: payerAddress || existingInvoice.payerAddress,
        paidAt: status === 'paid' ? new Date() : existingInvoice.paidAt,
        transactionSignature: transactionSignature || existingInvoice.transactionSignature
      };
      
      console.log('Invoice updated successfully:', updated[invoiceIndex]);
      console.log('All invoices after update:', updated);
      return updated;
    });
  };

  // Upsert (create or merge) an invoice atomically in state (prevents "not found" race conditions).
  const upsertInvoice = (invoice: Invoice) => {
    // Ensure amount is always a number and token has default
    const normalizedInvoice: Invoice = {
      ...invoice,
      amount: typeof invoice.amount === 'number' ? invoice.amount : parseFloat(String(invoice.amount)) || 0,
      token: invoice.token || 'SOL',
    };

    setInvoices(prev => {
      const existingIndex = prev.findIndex(inv => inv.id === normalizedInvoice.id);

      // Create
      if (existingIndex === -1) {
        return [normalizedInvoice, ...prev];
      }

      const existing = prev[existingIndex];

      // CRITICAL: Never overwrite a paid invoice with a pending one
      if (existing.status === 'paid' && normalizedInvoice.status === 'pending') {
        return prev;
      }

      const merged: Invoice = {
        ...existing,
        ...normalizedInvoice,
        status: existing.status === 'paid' ? 'paid' : normalizedInvoice.status,
        transactionSignature: existing.transactionSignature || normalizedInvoice.transactionSignature,
        payerAddress: existing.payerAddress || normalizedInvoice.payerAddress,
        paidAt: existing.paidAt || normalizedInvoice.paidAt,
      };

      const updated = [...prev];
      updated[existingIndex] = merged;
      return updated;
    });
  };

  // Ensure invoice exists in context - creates it if it doesn't exist
  const ensureInvoice = (invoice: Invoice): Invoice => {
    console.log('Ensuring invoice exists in context:', invoice);

    // Ensure amount is always a number and token has default
    const normalizedInvoice: Invoice = {
      ...invoice,
      amount: typeof invoice.amount === 'number' ? invoice.amount : parseFloat(String(invoice.amount)) || 0,
      token: invoice.token || 'SOL',
    };

    let resultInvoice: Invoice = normalizedInvoice;

    setInvoices(prev => {
      const existingIndex = prev.findIndex(inv => inv.id === normalizedInvoice.id);
      
      if (existingIndex !== -1) {
        const existing = prev[existingIndex];
        console.log('Invoice already exists:', existing);

        // CRITICAL: Never overwrite a paid invoice with a pending one
        if (existing.status === 'paid' && normalizedInvoice.status === 'pending') {
          console.log('Invoice is already paid, preserving paid status');
          resultInvoice = existing;
          return prev; // Don't change anything
        }

        // Merge existing invoice with new data, but preserve paid status and transaction info
        const merged: Invoice = {
          ...existing,
          ...normalizedInvoice,
          // Preserve paid status if already paid
          status: existing.status === 'paid' ? 'paid' : normalizedInvoice.status,
          // Preserve transaction signature if it exists
          transactionSignature: existing.transactionSignature || normalizedInvoice.transactionSignature,
          // Preserve payer address if it exists
          payerAddress: existing.payerAddress || normalizedInvoice.payerAddress,
          // Preserve paidAt if it exists
          paidAt: existing.paidAt || normalizedInvoice.paidAt,
        };

        resultInvoice = merged;
        const updated = [...prev];
        updated[existingIndex] = merged;
        console.log('Merged invoice:', merged);
        return updated;
      }

      console.log('Invoice does not exist, adding to context:', normalizedInvoice.id);
      // Add new invoice
      return [normalizedInvoice, ...prev];
    });
    
    return resultInvoice;
  };

  return (
    <InvoiceContext.Provider value={{ invoices, createInvoice, getInvoice, updateInvoiceStatus, upsertInvoice, ensureInvoice }}>
      {children}
    </InvoiceContext.Provider>
  );
}

export function useInvoices() {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoices must be used within an InvoiceProvider');
  }
  return context;
}
