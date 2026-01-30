# Faceless Payments

**Privacy-first invoicing on Solana.** Create invoices in **SOL** or **USD1**, share a link/QR, and let clients pay with **amount privacy** or **full anonymity** using **ShadowWire**.

- **Live demo**: [faceless.ibxlab.com](https://faceless.ibxlab.com/)
- **Demo video**: [YouTube](https://youtu.be/UPMZ4cpz7C8)
- **Radr Labs PR**: [aliveevie/faceless-payments#1](https://github.com/aliveevie/faceless-payments/pull/1)
- **ShadowWire**: [radr.dev/shadowwire](https://radr.dev/shadowwire)

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

