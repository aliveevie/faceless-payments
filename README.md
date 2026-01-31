# Faceless Payments

**Privacy-first invoicing on Solana.** Create invoices in **SOL** or **USD1**, share a link/QR, and let clients pay with **amount privacy** or **full anonymity** using **ShadowWire**.

- **Live demo**: [faceless.ibxlab.com](https://faceless.ibxlab.com/)
- **Presentation Demo**:[Youtube](https://youtu.be/fA1_Ur6cyq4)
- **Demo video**: [YouTube](https://youtu.be/E2jhhwCVuqc)
- **Radr Labs PR**: [aliveevie/faceless-payments#1](https://github.com/aliveevie/faceless-payments/pull/1)
- **ShadowWire**: [radr.dev/shadowwire](https://radr.dev/shadowwire)

## Radr Labs / ShadowWire integration (full)

This project is a **full end-to-end integration** of Radr Labs’ **ShadowWire** privacy rails into a real invoicing flow (create → share → pay → verify → withdraw).

- **SDK**: `@radr/shadowwire` (used directly from the app)
- **Networks**: **Solana mainnet-beta** (ShadowWire is mainnet-only)
- **Tokens supported**:
  - **SOL** (native)
  - **USD1** (stablecoin invoices)
- **Payment modes**:
  - **Private**: amount hidden
  - **Anonymous**: amount + sender hidden
- **Pool management UX**:
  - **Deposit** when pool balance is insufficient
  - **Withdraw** from pool back to wallet (Dashboard)
- **Verification UX**:
  - in-app **Solscan** link
  - automatic payment verification to mark invoices as paid

### Where the integration lives (code map)

- **ShadowWire transfers + verification**: `src/components/PaymentForm.tsx`
- **Pool deposit/withdraw UI**: `src/components/ShadowWirePool.tsx`
- **Tokenized invoices (SOL/USD1)**: `src/contexts/InvoiceContext.tsx`, `src/components/CreateInvoiceForm.tsx`
- **Share links w/ paid metadata**: `src/components/InvoiceCard.tsx`, `src/pages/PayInvoice.tsx`
- **Mainnet wallet/RPC**: `src/contexts/WalletContext.tsx` (uses `VITE_SOLANA_RPC_URL`)
- **Solana helpers**: `src/lib/solana.ts`

### End-to-end test plan (for judges)

1. **Create invoice** (Dashboard → New Invoice):
   - Choose **SOL** or **USD1**
   - Enter amount above minimum (table below)
   - Share invoice link/QR
2. **Pay invoice** (open `/pay/:id` link):
   - Connect wallet (mainnet)
   - Choose **Private** or **Anonymous**
   - If prompted, **deposit** to ShadowWire pool
   - Submit payment
3. **Verify**:
   - Click **View on Solscan** inside the UI
   - Confirm the payment reflects the chosen privacy mode
4. **Withdraw**:
   - Go back to Dashboard
   - Use **ShadowWire Pool** to withdraw remaining balance

## Why this matters

Freelancers often need invoices for legitimacy, but public blockchains leak sensitive business information:
- how much you charge
- who paid you
- how often you get paid
- which clients are your biggest customers

**Faceless Payments** keeps the UX of “send an invoice link” while making payments **meaningfully private on mainnet**.

## What we built (in 30 seconds)

- **Create invoice**: choose token (SOL/USD1), amount, description.
- **Share**: link + QR + Telegram/WhatsApp share.
- **Pay**: payer chooses:
  - **Private**: hides the *amount* (sender visible)
  - **Anonymous**: hides *sender + amount*
- **Pool UX**: guided deposit/withdraw flow for ShadowWire pool balance.
- **Verification**: app links to Solscan and auto-verifies receipt.

## Privacy modes (ShadowWire)

ShadowWire enables private transfers on Solana mainnet using zero-knowledge proofs.

- **Private mode**:
  - **Amount** is hidden
  - **Sender** may remain visible
  - Ideal for “I can be known, but my rate shouldn’t be”

- **Anonymous mode**:
  - **Amount** is hidden
  - **Sender identity** is hidden
  - Ideal for sensitive work and “pay without leaving a trail”

> ShadowWire is **mainnet-only**, so Faceless Payments is designed to run on **mainnet-beta**.

## Token support (SOL + USD1)

Invoices are **tokenized**: the invoice specifies the token and the payer can’t change it.

| Token | Minimum | Fee (via ShadowWire) | Why it matters |
|---|---:|---:|---|
| SOL | 0.1 SOL | 0.5% | native payments |
| USD1 | 1 USD1 | 0.3% | stable-value invoicing |

## How to verify privacy (judge checklist)

1. Open an invoice and pay using **Private** or **Anonymous** mode.
2. Click **View on Solscan**.
3. Confirm:
   - the **exact transfer amount** is not revealed for ShadowWire payments
   - in **Anonymous** mode, the **payer wallet** is not shown as the sender

## Architecture

High-signal layout:

```
src/
├── components/
│   ├── CreateInvoiceForm.tsx     # tokenized invoices (SOL/USD1)
│   ├── InvoiceCard.tsx           # share links, paid metadata, privacy badges
│   ├── PaymentForm.tsx           # ShadowWire payment UX + verification
│   └── ShadowWirePool.tsx        # deposit/withdraw pool UX
├── contexts/
│   ├── InvoiceContext.tsx        # invoice state + upsert + token support
│   └── WalletContext.tsx         # mainnet connection + wallet adapters
└── lib/
   └── solana.ts                  # Solana helpers + verification utilities
```

## Local setup

### Prerequisites
- Node.js 18+
- A Solana wallet (Phantom or Solflare recommended)
- Mainnet SOL for fees (and USD1 if you want USD1 invoices)

### Install & run

```bash
npm install
npm run dev
```

App runs at `http://localhost:8080`.

### Environment variables

Create a `.env` (not committed) if you want a custom RPC endpoint:

- `VITE_SOLANA_RPC_URL`: mainnet RPC URL for the wallet adapter connection

See `.env.example`.

