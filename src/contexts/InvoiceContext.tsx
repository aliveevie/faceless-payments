import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface Invoice {
  id: string;
  amount: number;
  description: string;
  recipientAddress: string;
  createdAt: Date;
  status: 'pending' | 'paid' | 'expired';
  payerAddress?: string;
  paidAt?: Date;
  expiresAt?: Date;
}

interface InvoiceContextType {
  invoices: Invoice[];
  createInvoice: (amount: number, description: string, recipientAddress: string) => Invoice;
  getInvoice: (id: string) => Invoice | undefined;
  updateInvoiceStatus: (id: string, status: Invoice['status'], payerAddress?: string) => void;
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
        createdAt: new Date(inv.createdAt),
        paidAt: inv.paidAt ? new Date(inv.paidAt) : undefined,
        expiresAt: inv.expiresAt ? new Date(inv.expiresAt) : undefined,
      }));
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  }, [invoices]);

  const createInvoice = (amount: number, description: string, recipientAddress: string): Invoice => {
    const newInvoice: Invoice = {
      id: uuidv4(),
      amount,
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

  const updateInvoiceStatus = (id: string, status: Invoice['status'], payerAddress?: string) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === id 
        ? { 
            ...inv, 
            status, 
            payerAddress, 
            paidAt: status === 'paid' ? new Date() : inv.paidAt 
          } 
        : inv
    ));
  };

  return (
    <InvoiceContext.Provider value={{ invoices, createInvoice, getInvoice, updateInvoiceStatus }}>
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
