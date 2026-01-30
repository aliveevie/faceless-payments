# Faceless Payments: Privacy-First Invoicing on Solana

## ShadowWire Integration for Privacy Hackathon 2026

### Overview

**Faceless Payments** is a privacy-focused invoicing application built on Solana that leverages **Radr Labs ShadowWire SDK** to enable anonymous, untraceable payments. Users can create invoices, share payment links, and receive payments without revealing their identity or transaction amounts on-chain.

---

## Key Features

### 1. Anonymous Payments via ShadowWire
- **Zero-Knowledge Proof Integration**: Utilizes ShadowWire's bulletproof-based ZK system for private transfers
- **Hidden Transaction Amounts**: On-chain observers cannot determine the payment value
- **Sender Anonymity**: Payer identity is protected through ShadowWire's privacy pool

### 2. External Transfers (Direct to Wallet)
- Funds are sent **directly to the recipient's wallet** - no withdrawal required
- Better UX than pool-to-pool transfers
- Recipients receive SOL/USD1 immediately in their main wallet

### 3. Automatic Payment Verification
- **Real-time blockchain monitoring** detects incoming payments automatically
- No manual confirmation links or refresh required
- Polls Solana RPC every 5 seconds to verify payment receipt
- Both sender and recipient see "Paid" status instantly

### 4. ShadowWire Pool Management
- **Deposit**: Fund your privacy pool directly from the dashboard
- **Withdraw**: Extract funds with proper handling of partially-signed transactions
- **Balance Display**: Real-time SOL and USD1 pool balances

### 5. Invoice System
- Create invoices with custom amounts and descriptions
- Share via QR code or direct link
- Supports SOL and USD1 tokens
- Persistent storage across sessions

---

## Technical Implementation

### ShadowWire SDK Integration

```typescript
// Initialize WASM for zero-knowledge proofs
import { ShadowWireClient, initWASM, isWASMSupported } from "@radr/shadowwire";
import wasmUrl from "@radr/shadowwire/wasm/settler_wasm_bg.wasm?url";

await initWASM(wasmUrl);
const client = new ShadowWireClient({ debug: true });
```

### Privacy Transfer Flow

```typescript
// External transfer - funds go directly to recipient wallet
const result = await client.transfer({
  sender: walletAddress,
  recipient: invoice.recipientAddress,
  amount: invoice.amount,
  token: "SOL",
  type: "external",  // Direct to wallet, not pool-to-pool
  wallet: { signMessage: (m) => signMessage(m) },
});
```

### Automatic Deposit When Needed

```typescript
// Auto-deposit to ShadowWire pool if balance insufficient
const depositResp = await client.deposit({
  wallet: walletAddress,
  amount: amountInLamports,
});
// Sign and send transaction...
```

### Withdrawal with Partially-Signed Transactions

```typescript
// ShadowWire withdrawals require 2 signatures
const withdrawResp = await client.withdraw({ wallet, amount, token_mint });
const txBytes = decodeBase64(withdrawResp.unsigned_tx_base64);

// Detect versioned vs legacy transaction
const isVersioned = txBytes[0] >= 128;

// Sign with user wallet and send raw transaction
const signedTx = await signTransaction(tx);
await connection.sendRawTransaction(signedTx.serialize());
```

### Automatic Payment Verification

```typescript
// Poll blockchain for incoming transfers to recipient
const result = await verifyPaymentReceived(
  connection,
  recipientAddress,
  expectedAmount,
  token,
  invoiceCreatedAt
);

if (result.found) {
  // Auto-update invoice status to "paid"
  upsertInvoice({ ...invoice, status: "paid", transactionSignature: result.signature });
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Faceless Payments UI                       │
├─────────────────────────────────────────────────────────────────┤
│  Invoice Creation  │  Payment Form  │  Dashboard & Pool Mgmt   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ShadowWire SDK (@radr/shadowwire)             │
├─────────────────────────────────────────────────────────────────┤
│  WASM ZK Proofs  │  Transfer API  │  Deposit/Withdraw API      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Solana Mainnet                             │
├─────────────────────────────────────────────────────────────────┤
│  Privacy Pool Program  │  Token Accounts  │  Transaction Logs  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | Description |
|------|-------------|
| `src/components/PaymentForm.tsx` | ShadowWire transfer integration, auto-verification polling |
| `src/components/ShadowWirePool.tsx` | Deposit/withdraw UI with pool balance display |
| `src/lib/solana.ts` | Payment verification via blockchain transaction parsing |
| `src/contexts/InvoiceContext.tsx` | Invoice state management with payment status sync |
| `src/pages/PayInvoice.tsx` | Invoice payment page with auto-update on payment |
| `src/pages/Dashboard.tsx` | Main dashboard with pool management integration |
| `package.json` | Added @radr/shadowwire SDK dependency |

---

## User Flow

### Creating an Invoice (Recipient)
1. Connect wallet on Dashboard
2. Click "New Invoice" and enter amount, token, description
3. Share the generated payment link or QR code

### Paying an Invoice (Payer)
1. Open the shared payment link
2. Connect wallet
3. Click "Pay" - auto-deposits to ShadowWire pool if needed
4. ShadowWire executes anonymous external transfer
5. Both parties see "Payment Complete" automatically

### Managing Privacy Pool
1. View SOL and USD1 balances on Dashboard
2. Deposit funds to prepare for future payments
3. Withdraw funds back to main wallet when needed

---

## Why ShadowWire?

| Feature | Traditional Transfer | ShadowWire Transfer |
|---------|---------------------|---------------------|
| Amount Visible | Yes | No (ZK hidden) |
| Sender Traceable | Yes | No (anonymous) |
| On-chain Privacy | None | Full bulletproof ZK |
| UX Complexity | Simple | Simple (we handle it) |

---

## Demo

**Live Demo**: [faceless-payments.vercel.app](https://faceless-payments.vercel.app)

**Test Flow**:
1. Create invoice on Device A
2. Open payment link on Device B
3. Pay with ShadowWire
4. Watch both devices auto-update to "Paid"

---

## Dependencies

- `@radr/shadowwire`: ^1.1.15 - ShadowWire SDK for privacy transfers
- `@solana/web3.js`: ^1.98.4 - Solana blockchain interaction
- `@solana/wallet-adapter-*`: Wallet connection (Phantom, Solflare, etc.)

---

## Submission Details

**Hackathon**: Privacy Hackathon 2026
**Bounty**: Radr Labs ShadowWire Integration ($15,000)
**Track**: Privacy-Preserving Payments

**Team**: Faceless Payments
**Repository**: [github.com/aliveevie/faceless-payments](https://github.com/aliveevie/faceless-payments)
**Branch**: `Impl_shadow_wire`

---

## License

MIT License - Open source and free to use.

---

*Built with ShadowWire by Radr Labs - Making privacy accessible on Solana.*
