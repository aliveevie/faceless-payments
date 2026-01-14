import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { FileText, LayoutDashboard } from 'lucide-react';

export function Header() {
  const { connected } = useWallet();

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <Logo size="sm" />
        </Link>

        <nav className="flex items-center gap-4">
          {connected && (
            <>
              <Link to="/create">
                <Button variant="ghost" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Create Invoice
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            </>
          )}
          <WalletMultiButton className="!bg-primary !text-primary-foreground !font-mono !rounded-lg !h-10 !px-4 hover:!shadow-[0_0_20px_hsl(var(--primary)/0.4)] !transition-all" />
        </nav>
      </div>
    </motion.header>
  );
}
