import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Invoice, useInvoices } from '@/contexts/InvoiceContext';
import { Wallet, ArrowRight, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  invoice: Invoice;
}

export function PaymentForm({ invoice: initialInvoice }: PaymentFormProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { updateInvoiceStatus, getInvoice, invoices, ensureInvoice } = useInvoices();
  
  // Get the latest invoice from context to keep it in sync
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  
  // Update invoice when context changes (after payment)
  useEffect(() => {
    const latestInvoice = invoices.find(inv => inv.id === initialInvoice.id);
    if (latestInvoice) {
      console.log('Invoice updated from context:', latestInvoice);
      setInvoice(latestInvoice);
      // Also update isPaid state
      if (latestInvoice.status === 'paid') {
        setIsPaid(true);
      }
    }
  }, [invoices, initialInvoice.id]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPaid, setIsPaid] = useState(invoice.status === 'paid');
  const [transactionSignature, setTransactionSignature] = useState<string | null>(null);
  
  // Update isPaid when invoice status changes
  useEffect(() => {
    setIsPaid(invoice.status === 'paid');
  }, [invoice.status]);

  const handlePayment = async () => {
    if (!publicKey || !connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Prevent duplicate payments - check if invoice is already paid
    if (invoice.status === 'paid') {
      toast.error('This invoice has already been paid', {
        description: invoice.transactionSignature 
          ? `Transaction: ${invoice.transactionSignature.slice(0, 8)}...${invoice.transactionSignature.slice(-8)}`
          : 'Please check the invoice details.',
      });
      return;
    }

    // Check if current user already paid this invoice
    if (invoice.payerAddress === publicKey.toBase58()) {
      toast.error('You have already paid this invoice', {
        description: 'This invoice was already paid by your wallet address.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const recipientPubkey = new PublicKey(invoice.recipientAddress);
      const lamports = Math.round(invoice.amount * LAMPORTS_PER_SOL);

      // Check sender balance before creating transaction
      const senderBalance = await connection.getBalance(publicKey, 'confirmed');
      const requiredBalance = lamports + 5000; // Amount + estimated fee (5000 lamports)
      
      if (senderBalance < requiredBalance) {
        throw new Error('Insufficient funds. You need enough SOL to cover the transfer amount plus transaction fees.');
      }

      // Get fresh blockhash - CRITICAL: Get this right before sending
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      
      // Create transaction with fresh blockhash
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      console.log('Sending transaction with blockhash:', blockhash);
      
      // Send transaction - wallet adapter handles signing and broadcasting
      let signature: string;
      try {
        signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3, // Allow retries for better reliability
        });
        console.log('Transaction signature received:', signature);
      } catch (sendError: any) {
        console.error('Error sending transaction:', sendError);
        
        // Check for network errors
        const errorMessage = sendError?.message || String(sendError);
        if (errorMessage.includes('Network') || 
            errorMessage.includes('fetch') || 
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('timeout')) {
          throw new Error('Network error: Unable to connect to Solana network. Please check your internet connection and try again.');
        }
        
        // Re-throw other errors
        throw sendError;
      }
      
      // Set signature and show confirming state immediately
      // sendTransaction from wallet adapter only returns signature if transaction was sent
      setTransactionSignature(signature);
      setIsProcessing(false);
      setIsConfirming(true);
      
      // Try to verify transaction exists (non-blocking, for logging purposes)
      // Don't throw errors here - just log for debugging
      // The transaction confirmation below will catch actual failures
      (async () => {
        try {
          // Wait a moment for transaction to propagate
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          let verificationAttempts = 0;
          const maxVerificationAttempts = 5;
          
          while (verificationAttempts < maxVerificationAttempts) {
            try {
              const txStatus = await connection.getSignatureStatus(signature, {
                searchTransactionHistory: true,
              });
              
              if (txStatus.value !== null) {
                console.log('Transaction verified on blockchain:', txStatus.value);
                
                // If transaction already failed, log it (confirmation will handle it)
                if (txStatus.value.err) {
                  console.error('Transaction error detected:', txStatus.value.err);
                }
                break;
              }
            } catch (verifyError: any) {
              // Network errors during verification are not critical
              // The transaction might still be processing
              console.log(`Verification attempt ${verificationAttempts + 1} failed (non-critical):`, verifyError?.message || verifyError);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            verificationAttempts++;
          }
        } catch (verifyError) {
          // Verification errors are non-critical - transaction might still succeed
          console.log('Transaction verification failed (non-critical):', verifyError);
        }
      })();
      
      const explorerUrl = `https://solscan.io/tx/${signature}?cluster=testnet`;
      
      // Show transaction sent message
      toast.info('Transaction sent! Confirming...', {
        description: `Signature: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        action: {
          label: 'View on Solscan',
          onClick: () => window.open(explorerUrl, '_blank'),
        },
        duration: 10000,
      });

      // Confirm transaction using blockhash method (most reliable)
      try {
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          'confirmed'
        );

        // Check if transaction failed
        if (confirmation.value.err) {
          setIsConfirming(false);
          toast.error('Payment failed', {
            description: `Transaction error: ${JSON.stringify(confirmation.value.err)}`,
          });
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        console.log('Transaction confirmed:', confirmation);
        
        // IMMEDIATELY update invoice status after confirmation
        ensureInvoice(invoice);
        updateInvoiceStatus(invoice.id, 'paid', publicKey.toBase58(), signature);
        
        // Update local state immediately
        setInvoice(prev => ({
          ...prev,
          status: 'paid',
          payerAddress: publicKey.toBase58(),
          paidAt: new Date(),
          transactionSignature: signature
        }));
        
        setIsPaid(true);
        setIsConfirming(false);
        
        // Show success toast immediately
        toast.success('Payment confirmed!', {
          description: 'Transaction confirmed on Solana Testnet',
          action: {
            label: 'View on Solscan',
            onClick: () => window.open(explorerUrl, '_blank'),
          },
          duration: 10000,
        });
        
        return; // Exit early - payment is complete
      } catch (confirmError: any) {
        // If confirmTransaction times out or fails, fall back to polling
        // This handles network issues and RPC latency
        console.log('confirmTransaction timed out or failed, falling back to polling...', confirmError?.message || confirmError);
        
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = 120; // 60 seconds max (120 * 500ms)
        
        while (!confirmed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            const status = await connection.getSignatureStatus(signature, {
              searchTransactionHistory: true,
            });
            
            if (status.value?.err) {
              setIsConfirming(false);
              toast.error('Payment failed', {
                description: `Transaction error: ${JSON.stringify(status.value.err)}`,
              });
              throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }
            
            // Check if transaction is confirmed or finalized
            if (status.value && (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized')) {
              confirmed = true;
              console.log('Transaction confirmed via polling:', status.value);
              
              // IMMEDIATELY update invoice status after confirmation
              ensureInvoice(invoice);
              updateInvoiceStatus(invoice.id, 'paid', publicKey.toBase58(), signature);
              
              // Update local state immediately
              setInvoice(prev => ({
                ...prev,
                status: 'paid',
                payerAddress: publicKey.toBase58(),
                paidAt: new Date(),
                transactionSignature: signature
              }));
              
              setIsPaid(true);
              setIsConfirming(false);
              
              // Show success toast immediately
              toast.success('Payment confirmed!', {
                description: 'Transaction confirmed on Solana Testnet',
                action: {
                  label: 'View on Solscan',
                  onClick: () => window.open(explorerUrl, '_blank'),
                },
                duration: 10000,
              });
              
              break;
            }
          } catch (pollError: any) {
            // Network errors during polling - log but continue
            // Don't break the loop on network errors, transaction might still be processing
            if (attempts % 10 === 0) { // Log every 5 seconds
              console.log('Polling error (continuing):', pollError?.message || pollError);
            }
          }
          
          attempts++;
        }

        if (!confirmed) {
          setIsConfirming(false);
          // Check one more time if transaction exists (might have succeeded)
          try {
            const finalStatus = await connection.getSignatureStatus(signature, {
              searchTransactionHistory: true,
            });
            
            if (finalStatus.value && !finalStatus.value.err) {
              // Transaction exists and succeeded!
              // Ensure invoice exists in context before updating
              ensureInvoice(invoice);
              
              updateInvoiceStatus(invoice.id, 'paid', publicKey.toBase58(), signature);
              
              // Update local state immediately
              setInvoice(prev => ({
                ...prev,
                status: 'paid',
                payerAddress: publicKey.toBase58(),
                paidAt: new Date(),
                transactionSignature: signature
              }));
              
              setIsPaid(true);
              setIsConfirming(false);
              
              // Show success toast immediately
              toast.success('Payment confirmed!', {
                description: 'Transaction confirmed on Solana Testnet',
                action: {
                  label: 'View on Solscan',
                  onClick: () => window.open(explorerUrl, '_blank'),
                },
                duration: 10000,
              });
              return;
            }
          } catch (finalCheckError) {
            console.log('Final check error:', finalCheckError);
          }
          
          // If we get here, transaction might still be processing
          toast.warning('Confirmation timeout', {
            description: 'Transaction was sent but confirmation is taking longer than expected. Please check Solscan - it may still be processing.',
            action: {
              label: 'View on Solscan',
              onClick: () => window.open(explorerUrl, '_blank'),
            },
            duration: 15000,
          });
          return;
        }
      }

      // This code should never be reached if confirmation worked above
      // But keeping it as a fallback
      ensureInvoice(invoice);
      updateInvoiceStatus(invoice.id, 'paid', publicKey.toBase58(), signature);
      
      // Update local state immediately
      setInvoice(prev => ({
        ...prev,
        status: 'paid',
        payerAddress: publicKey.toBase58(),
        paidAt: new Date(),
        transactionSignature: signature
      }));
      
      setIsPaid(true);
      setIsConfirming(false);
      
      toast.success('Payment confirmed!', {
        description: 'Transaction confirmed on Solana Testnet',
        action: {
          label: 'View on Solscan',
          onClick: () => window.open(explorerUrl, '_blank'),
        },
        duration: 10000,
      });

    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Reset states on error
      setIsConfirming(false);
      setIsProcessing(false);
      
      // Provide more specific error messages
      let errorMessage = 'Payment failed. Please try again.';
      let description = '';
      
      if (error.message) {
        // Network-related errors
        if (error.message.includes('Network request failed') || 
            error.message.includes('fetch failed') || 
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('network')) {
          errorMessage = 'Network error';
          description = 'There was a network issue. The transaction may have been sent. Please check Solscan or try again.';
        } else if (error.message.includes('block height exceeded') || error.message.includes('expired') || error.message.includes('blockhash not found')) {
          errorMessage = 'Transaction expired. Please try again.';
          description = 'The transaction took too long. Please retry.';
        } else if (error.message.includes('insufficient funds') || error.message.includes('Insufficient')) {
          errorMessage = 'Insufficient funds';
          description = 'Please check your wallet balance on Solana Testnet. You need enough SOL for the transfer plus transaction fees.';
        } else if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled';
          description = 'You cancelled the transaction in your wallet.';
        } else if (error.message.includes('timeout') || error.message.includes('not confirmed')) {
          errorMessage = 'Transaction confirmation timeout';
          description = transactionSignature 
            ? `Transaction was sent but not confirmed. Check Solana Explorer: ${transactionSignature.slice(0, 8)}...`
            : 'Transaction was sent but confirmation timed out. Please check Solana Explorer.';
        } else {
          errorMessage = error.message;
          description = 'Make sure your wallet is connected to Solana Testnet.';
        }
      }
      
      toast.error(errorMessage, {
        description: description || 'Make sure your wallet is connected to Solana Testnet.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPaid || invoice.status === 'paid') {
    const explorerUrl = invoice.transactionSignature 
      ? `https://solscan.io/tx/${invoice.transactionSignature}?cluster=testnet`
      : null;
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        </div>
        <h3 className="font-mono text-2xl font-bold text-green-400 mb-2">Payment Complete</h3>
        <p className="text-muted-foreground mb-4">
          This invoice has been paid successfully.
        </p>
        
        {invoice.payerAddress && (
          <p className="text-sm text-muted-foreground mb-2 font-mono">
            Paid by: {invoice.payerAddress.slice(0, 8)}...{invoice.payerAddress.slice(-6)}
          </p>
        )}
        
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-mono mt-4"
          >
            View transaction on Solscan
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </motion.div>
    );
  }

  if (invoice.status === 'expired') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-8 text-center"
      >
        <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="font-mono text-2xl font-bold text-destructive mb-2">Invoice Expired</h3>
        <p className="text-muted-foreground">
          This invoice is no longer valid.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card-glow p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-mono text-xl font-bold">Pay Invoice</h2>
          <p className="text-sm text-muted-foreground">Send SOL to complete payment</p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground font-mono mb-1">Amount to pay</p>
          <p className="text-3xl font-bold font-mono text-gradient">
            {invoice.amount} <span className="text-lg">SOL</span>
          </p>
        </div>

        {invoice.description && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-sm text-muted-foreground font-mono mb-1">For</p>
            <p className="text-foreground">{invoice.description}</p>
          </div>
        )}

        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-sm text-muted-foreground font-mono mb-1">Sending to</p>
          <p className="font-mono text-sm truncate text-foreground/80">
            {invoice.recipientAddress}
          </p>
        </div>
      </div>

      {isConfirming ? (
        <div className="space-y-4">
          <div className="p-6 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <h3 className="font-mono text-lg font-bold mb-2">Confirming Transaction...</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Waiting for blockchain confirmation. This may take a few seconds.
            </p>
            {transactionSignature && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-mono">
                  Signature: {transactionSignature.slice(0, 16)}...{transactionSignature.slice(-8)}
                </p>
                <a
                  href={`https://solscan.io/tx/${transactionSignature}?cluster=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-block"
                >
                  View on Solana Explorer →
                </a>
              </div>
            )}
          </div>
        </div>
      ) : !connected ? (
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Connect your wallet to pay</p>
          <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-12 !px-8 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all !mx-auto" />
        </div>
      ) : (
        <Button
          variant="glow"
          size="lg"
          className="w-full group"
          onClick={handlePayment}
          disabled={isProcessing || isConfirming}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              Pay {invoice.amount} SOL
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      )}

      <div className="mt-4 space-y-2">
        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs font-mono text-yellow-400 text-center">
            ⚠️ Make sure your wallet is set to <strong>Solana Testnet</strong>
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Switch network in your wallet settings if needed
          </p>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Payments are processed on Solana Testnet • Get free testnet SOL from faucets
        </p>
      </div>
    </motion.div>
  );
}
