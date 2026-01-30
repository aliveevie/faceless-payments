import { useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getSolscanTxUrl } from '@/lib/solana';

// ShadowWire SDK
import wasmUrl from '@radr/shadowwire/wasm/settler_wasm_bg.wasm?url';
import { ShadowWireClient, initWASM, isWASMSupported } from '@radr/shadowwire';

interface PoolBalance {
  sol: number;
  usd1: number;
}

// ShadowWire minimum amounts (from anti-spam protection)
const MIN_DEPOSIT = {
  SOL: 0.01,   // 10,000,000 lamports
  USD1: 0.01,  // 10,000 smallest units
};

const MIN_WITHDRAW = {
  SOL: 0.1,    // 100,000,000 lamports
  USD1: 1.0,   // 1,000,000 smallest units
};

const USD1_MINT = 'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB';

export function ShadowWirePool() {
  const { publicKey, connected, sendTransaction, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [client] = useState(() => new ShadowWireClient({ debug: true }));
  const [wasmInitialized, setWasmInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [poolBalance, setPoolBalance] = useState<PoolBalance>({ sol: 0, usd1: 0 });
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositToken, setDepositToken] = useState<'SOL' | 'USD1'>('SOL');

  const decodeBase64ToUint8Array = (b64: string): Uint8Array => {
    const binStr = globalThis.atob(b64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
  };

  // Same confirmation logic as PaymentForm
  const confirmSignature = async (signature: string, timeoutMs: number = 90_000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
        if (status.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        if (status.value?.confirmationStatus === "confirmed" || status.value?.confirmationStatus === "finalized") {
          return true;
        }
      } catch (err: any) {
        if (err?.message?.includes("WrongSize") || err?.message?.includes("Invalid param")) {
          console.error("RPC error checking signature:", err);
          throw new Error(`RPC error: ${err.message}`);
        }
        console.warn("Transient error checking signature:", err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };

  const loadBalances = async () => {
    if (!publicKey || !wasmInitialized) return;

    setIsLoading(true);
    try {
      const wallet = publicKey.toBase58();

      // Load SOL balance
      const solData = await client.getBalance(wallet, 'SOL');
      const solBalance = solData.available / 1e9;

      // Load USD1 balance
      let usd1Balance = 0;
      try {
        const usd1Data = await client.getBalance(wallet, 'USD1');
        usd1Balance = usd1Data.available / 1e6;
      } catch {
        // USD1 might not be available
      }

      setPoolBalance({ sol: solBalance, usd1: usd1Balance });
      console.log('[ShadowWirePool] Balances:', { sol: solBalance, usd1: usd1Balance });
    } catch (err) {
      console.error('[ShadowWirePool] Failed to load balances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Same deposit logic as PaymentForm
  const handleDeposit = async () => {
    if (!publicKey || !sendTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const minAmount = MIN_DEPOSIT[depositToken];
    if (amount < minAmount) {
      toast.error(`Minimum deposit is ${minAmount} ${depositToken}`);
      return;
    }

    setIsDepositing(true);
    try {
      const wallet = publicKey.toBase58();
      const decimals = depositToken === 'SOL' ? 9 : 6;
      const amountSmallest = Math.ceil(amount * Math.pow(10, decimals));

      console.log(`[Deposit] Wallet: ${wallet}`);
      console.log(`[Deposit] Depositing ${amount} ${depositToken} (${amountSmallest} smallest units)`);

      // Build deposit request (same as PaymentForm)
      const depositRequest: any = {
        wallet: wallet,
        amount: amountSmallest,
      };

      if (depositToken !== 'SOL') {
        depositRequest.token_mint = USD1_MINT;
      }

      console.log('[Deposit] Request:', JSON.stringify(depositRequest, null, 2));

      const depositResp = await client.deposit(depositRequest);
      console.log('[Deposit] Response:', JSON.stringify(depositResp, null, 2));

      if (!depositResp.unsigned_tx_base64) {
        throw new Error(`Deposit API error: ${(depositResp as any)?.error || 'No transaction returned'}`);
      }

      // Same transaction handling as PaymentForm
      const txBytes = decodeBase64ToUint8Array(depositResp.unsigned_tx_base64);
      const tx = Transaction.from(txBytes);

      const { blockhash } = await connection.getLatestBlockhash('finalized');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Use sendTransaction from wallet adapter (same as PaymentForm)
      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      const txUrl = getSolscanTxUrl(signature);
      toast.info('Deposit submitted', {
        description: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        action: { label: 'View on Solscan', onClick: () => window.open(txUrl, '_blank') },
        duration: 12000,
      });

      // Wait for confirmation with polling (same as PaymentForm)
      const confirmed = await confirmSignature(signature, 90_000);
      if (!confirmed) {
        toast.warning('Deposit submitted but not confirmed yet', {
          description: 'Check Solscan for status',
          action: { label: 'View on Solscan', onClick: () => window.open(txUrl, '_blank') },
          duration: 15000,
        });
        return;
      }

      toast.success('Deposit confirmed!', {
        description: `${amount} ${depositToken} is now in your ShadowWire pool`,
      });

      setDepositAmount('');
      await loadBalances();
    } catch (err: any) {
      console.error('[Deposit] Full error:', err);
      let errorMsg = 'Please try again';
      if (err?.message) {
        errorMsg = err.message;
      }
      toast.error('Deposit failed', {
        description: errorMsg,
        duration: 10000,
      });
    } finally {
      setIsDepositing(false);
    }
  };

  // Withdraw uses signTransaction + sendRawTransaction because
  // ShadowWire withdraw transactions are partially signed (require 2 signatures)
  const handleWithdraw = async (token: 'SOL' | 'USD1') => {
    if (!publicKey || !signTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    const balance = token === 'SOL' ? poolBalance.sol : poolBalance.usd1;
    const decimals = token === 'SOL' ? 9 : 6;
    const minAmount = MIN_WITHDRAW[token];

    if (balance <= 0) {
      toast.error(`No ${token} available to withdraw`);
      return;
    }

    if (balance < minAmount) {
      toast.error(`Balance below minimum`, {
        description: `ShadowWire requires at least ${minAmount} ${token} to withdraw. Your balance: ${balance.toFixed(4)} ${token}`,
        duration: 8000,
      });
      return;
    }

    setIsWithdrawing(true);
    try {
      const wallet = publicKey.toBase58();
      const amountSmallest = Math.floor(balance * Math.pow(10, decimals));

      console.log(`[Withdraw] Wallet: ${wallet}`);
      console.log(`[Withdraw] Withdrawing ${balance} ${token} (${amountSmallest} smallest units)`);

      const withdrawRequest: any = {
        wallet: wallet,
        amount: amountSmallest,
      };

      if (token !== 'SOL') {
        withdrawRequest.token_mint = USD1_MINT;
      }

      console.log('[Withdraw] Request:', JSON.stringify(withdrawRequest, null, 2));

      const withdrawResp = await client.withdraw(withdrawRequest);
      console.log('[Withdraw] Response:', JSON.stringify(withdrawResp, null, 2));

      if (!withdrawResp.unsigned_tx_base64) {
        throw new Error(`Withdraw API error: ${(withdrawResp as any)?.error || 'No transaction returned'}`);
      }

      const txBytes = decodeBase64ToUint8Array(withdrawResp.unsigned_tx_base64);

      // Check first byte: >= 128 means versioned, < 128 is signature count for legacy
      const firstByte = txBytes[0];
      const isVersioned = firstByte >= 128;
      console.log(`[Withdraw] First byte: ${firstByte}, isVersioned: ${isVersioned}`);

      let signature: string;

      if (isVersioned) {
        // Versioned transaction
        const versionedTx = VersionedTransaction.deserialize(txBytes);
        console.log('[Withdraw] Deserialized as VersionedTransaction');

        const signedTx = await signTransaction(versionedTx);
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      } else {
        // Legacy transaction - might be partially signed by ShadowWire
        const tx = Transaction.from(txBytes);
        console.log(`[Withdraw] Legacy tx, signatures required: ${firstByte}`);

        // Don't overwrite blockhash if already set (ShadowWire sets it)
        if (!tx.recentBlockhash) {
          const { blockhash } = await connection.getLatestBlockhash('finalized');
          tx.recentBlockhash = blockhash;
        }

        // Sign with user's wallet (adds our signature to the partially-signed tx)
        const signedTx = await signTransaction(tx);
        console.log('[Withdraw] Signed transaction');

        // Send raw transaction (don't use sendTransaction which tries to re-sign)
        signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        });
      }

      console.log('[Withdraw] Transaction sent:', signature);

      const txUrl = getSolscanTxUrl(signature);
      toast.info('Withdrawal submitted', {
        description: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
        action: { label: 'View on Solscan', onClick: () => window.open(txUrl, '_blank') },
        duration: 12000,
      });

      const confirmed = await confirmSignature(signature, 90_000);
      if (!confirmed) {
        toast.warning('Withdrawal submitted but not confirmed yet', {
          description: 'Check Solscan for status',
          action: { label: 'View on Solscan', onClick: () => window.open(txUrl, '_blank') },
          duration: 15000,
        });
        return;
      }

      toast.success('Withdrawal confirmed!', {
        description: `${balance.toFixed(4)} ${token} is now in your wallet`,
      });

      await loadBalances();
    } catch (err: any) {
      console.error('[Withdraw] Full error:', err);
      let errorMsg = 'Please try again';
      if (err?.message) {
        errorMsg = err.message;
      }
      toast.error('Withdrawal failed', {
        description: errorMsg,
        duration: 10000,
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  useEffect(() => {
    async function init() {
      if (!isWASMSupported()) return;
      try {
        await initWASM(wasmUrl);
        setWasmInitialized(true);
      } catch (err) {
        console.error('[ShadowWirePool] WASM init failed:', err);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (wasmInitialized && publicKey) {
      loadBalances();
    }
  }, [wasmInitialized, publicKey?.toBase58()]);

  if (!connected) return null;

  const hasBalance = poolBalance.sol > 0 || poolBalance.usd1 > 0;
  const solBelowMin = poolBalance.sol > 0 && poolBalance.sol < MIN_WITHDRAW.SOL;
  const usd1BelowMin = poolBalance.usd1 > 0 && poolBalance.usd1 < MIN_WITHDRAW.USD1;
  const isProcessing = isDepositing || isWithdrawing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="glass-card-glow p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-mono font-bold">ShadowWire Pool</h3>
            <p className="text-xs text-muted-foreground">Private payment balance</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadBalances}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading && !hasBalance ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Deposit Section */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground font-mono mb-2">Deposit to Pool</p>
            <div className="flex gap-2">
              <div className="flex-1 flex gap-1">
                <Input
                  type="number"
                  placeholder={`Min ${MIN_DEPOSIT[depositToken]}`}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="font-mono h-9"
                  step="0.01"
                  min={MIN_DEPOSIT[depositToken]}
                  disabled={isProcessing}
                />
                <select
                  value={depositToken}
                  onChange={(e) => setDepositToken(e.target.value as 'SOL' | 'USD1')}
                  className="h-9 px-2 rounded-md bg-secondary border border-border font-mono text-sm"
                  disabled={isProcessing}
                >
                  <option value="SOL">SOL</option>
                  <option value="USD1">USD1</option>
                </select>
              </div>
              <Button
                variant="glow"
                size="sm"
                onClick={handleDeposit}
                disabled={isProcessing || !depositAmount || parseFloat(depositAmount) < MIN_DEPOSIT[depositToken]}
                className="h-9"
              >
                {isDepositing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ArrowUpFromLine className="h-4 w-4 mr-1" />
                    Deposit
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* SOL Balance */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div>
              <p className="text-xs text-muted-foreground font-mono">SOL Balance</p>
              <p className="text-xl font-bold font-mono">
                {poolBalance.sol.toFixed(4)} <span className="text-sm text-muted-foreground">SOL</span>
              </p>
              {solBelowMin && (
                <p className="text-xs text-yellow-500 mt-1">
                  Min {MIN_WITHDRAW.SOL} SOL to withdraw
                </p>
              )}
            </div>
            <Button
              variant="glow"
              size="sm"
              onClick={() => handleWithdraw('SOL')}
              disabled={isProcessing || poolBalance.sol < MIN_WITHDRAW.SOL}
            >
              {isWithdrawing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ArrowDownToLine className="h-4 w-4 mr-1" />
                  Withdraw
                </>
              )}
            </Button>
          </div>

          {/* USD1 Balance */}
          {poolBalance.usd1 > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div>
                <p className="text-xs text-muted-foreground font-mono">USD1 Balance</p>
                <p className="text-xl font-bold font-mono">
                  {poolBalance.usd1.toFixed(2)} <span className="text-sm text-muted-foreground">USD1</span>
                </p>
                {usd1BelowMin && (
                  <p className="text-xs text-yellow-500 mt-1">
                    Min {MIN_WITHDRAW.USD1} USD1 to withdraw
                  </p>
                )}
              </div>
              <Button
                variant="glow"
                size="sm"
                onClick={() => handleWithdraw('USD1')}
                disabled={isProcessing || poolBalance.usd1 < MIN_WITHDRAW.USD1}
              >
                {isWithdrawing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ArrowDownToLine className="h-4 w-4 mr-1" />
                    Withdraw
                  </>
                )}
              </Button>
            </div>
          )}

          {!hasBalance && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Deposit funds to make private payments
            </p>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Deposit from wallet → Pool • Withdraw from Pool → Wallet
          </p>
        </div>
      )}
    </motion.div>
  );
}
