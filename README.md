# Faceless Payments

**Privacy-first invoicing for freelancers on Solana** — Built with [ShadowWire](https://radr.dev/shadowwire) for the Privacy Hackathon 2026

## Overview

Faceless Payments is a privacy-focused invoicing application that lets freelancers and businesses create invoices and receive payments with hidden transaction amounts and optional sender anonymity. Built on Solana mainnet, it leverages ShadowWire's zero-knowledge proof system to enable truly private payments.

## Radr Lab Integration PR: https://github.com/aliveevie/faceless-payments/pull/1

### Key Features

- **Private Invoices**: Create invoices in SOL or USD1 stablecoin
- **ShadowWire Integration**: Two privacy modes for payers:
  - **Private Mode**: Hides the payment amount using bulletproof ZK proofs (sender visible)
  - **Anonymous Mode**: Hides both the sender identity and amount (complete anonymity)
- **Multi-Token Support**: Native SOL and USD1 stablecoin invoices
- **Mainnet-Only**: Real privacy on Solana mainnet (ShadowWire only works on mainnet)
- **Shareable Links**: QR codes and share links for Telegram/WhatsApp

## How ShadowWire Integration Works

### For Invoice Recipients (Freelancers)
1. Connect your Solana wallet
2. Create an invoice specifying amount (SOL or USD1) and description
3. Share the invoice link with your client
4. Receive private payments directly to your wallet

### For Payers (Clients)
1. Open the invoice link
2. Connect your Solana wallet
3. Choose payment mode:
   - **Private**: Your wallet is visible, but the amount is hidden on-chain
   - **Anonymous**: Both your identity and the amount are hidden
4. Ensure you have sufficient ShadowWire pool balance (deposit if needed)
5. Complete the payment

### Technical Implementation

```
src/
├── lib/
│   ├── shadowwire.ts    # ShadowWire SDK wrapper with privacy transfer logic
│   └── solana.ts        # Solana mainnet configuration
├── components/
│   ├── PaymentForm.tsx  # ShadowWire payment UI with mode selection
│   ├── CreateInvoiceForm.tsx  # Multi-token invoice creation
│   └── InvoiceCard.tsx  # Invoice display with privacy badges
└── contexts/
    ├── InvoiceContext.tsx  # Invoice state with token support
    └── WalletContext.tsx   # Mainnet wallet provider
```

The app uses the `@radr/shadowwire` SDK to:
- Check user's ShadowWire pool balance
- Execute private transfers (internal pool transfers with ZK proofs)
- Execute anonymous transfers (external transfers with hidden sender)
- Handle both SOL and USD1 tokens with proper decimals

## USD1 Stablecoin Support

USD1 is fully supported for stable-value invoices:

| Token | Minimum Amount | ShadowWire Fee | Use Case |
|-------|---------------|----------------|----------|
| SOL   | 0.1 SOL       | 0.5%           | Native payments |
| USD1  | 1 USD1        | 0.3%           | Stable-value invoices |

When creating an invoice, select the token type. Payers must pay in the specified token — they cannot change it.

## Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/faceless-payments
cd faceless-payments

# Install dependencies (includes local ShadowWire SDK)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

## Demo Instructions

### Prerequisites
- A Solana wallet (Phantom or Solflare recommended)
- Mainnet SOL for gas fees
- ShadowWire pool balance (deposit SOL or USD1 first)

### Creating an Invoice
1. Navigate to the app and connect your wallet
2. Click "New Invoice"
3. Select token (SOL or USD1)
4. Enter amount (min 0.1 SOL or 1 USD1)
5. Add description
6. Click "Generate Invoice"
7. Share the link via QR code, Telegram, or WhatsApp

### Paying an Invoice
1. Open the invoice link
2. Connect your wallet
3. Select privacy mode:
   - **Private**: Faster, amount hidden, sender visible
   - **Anonymous**: Full privacy, both hidden
4. If pool balance is zero, you'll see a prompt to deposit first
5. Click "Pay Invoice"
6. Approve the transaction in your wallet

### Verifying Privacy
After payment:
1. Check the transaction on Solscan (link provided in the app)
2. **Private payments**: You'll see the sender wallet but NOT the exact amount transferred
3. **Anonymous payments**: The transaction shows the ShadowWire pool as the sender, not the payer's wallet

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Blockchain**: Solana Web3.js
- **Wallets**: Solana Wallet Adapter (Phantom, Solflare)
- **Privacy**: ShadowWire SDK (@radr/shadowwire)
- **UI**: Framer Motion, Lucide Icons

## Project Structure

```
faceless-payments/
├── ShadowWire/          # Local ShadowWire SDK
├── src/
│   ├── components/      # React components
│   ├── contexts/        # React contexts (Wallet, Invoice)
│   ├── lib/             # Utilities (shadowwire, solana)
│   ├── pages/           # Route pages
│   └── index.css        # Global styles
├── package.json         # Dependencies (includes @radr/shadowwire)
└── vite.config.ts       # Vite configuration
```

## Bounty Submission

**Privacy Hackathon 2026 - Radr Labs ShadowWire Bounty**

This submission targets:
- **Grand Prize ($10,000)**: Best overall ShadowWire integration
- **Best USD1 Integration ($2,500)**: Full USD1 stablecoin support
- **Best Integration to Existing App ($2,500)**: Privacy layer for real-world invoicing

### What Makes This Submission Stand Out

1. **Real Use Case**: Privacy invoicing solves a genuine problem for freelancers who want financial privacy
2. **Complete USD1 Support**: Full stablecoin workflow from invoice creation to private payment
3. **Two Privacy Modes**: Users can choose between private (faster) and anonymous (more private)
4. **Production-Ready**: Mainnet-only, proper error handling, deposit prompts when balance is zero
5. **Clean UX**: Simple invoice creation, shareable links, clear privacy badges

## License

MIT

---

Built for the Privacy Hackathon 2026 by targeting the [Radr Labs ShadowWire bounty](https://radr.dev/bounty)
