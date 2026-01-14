import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';

export function HeroSection() {
  const { connected } = useWallet();
  const navigate = useNavigate();

  const features = [
    {
      icon: Shield,
      title: 'Stay Anonymous',
      description: 'No KYC, no identity verification. Just your wallet.',
    },
    {
      icon: Zap,
      title: 'Instant Payments',
      description: 'Receive SOL directly. No intermediaries.',
    },
    {
      icon: Globe,
      title: 'Share Anywhere',
      description: 'Telegram, WhatsApp, or any platform.',
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-glow-secondary/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/60 border border-border/50 backdrop-blur-sm mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-mono text-muted-foreground">Built on Solana</span>
          </motion.div>

          <h1 className="font-mono text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-foreground">Get paid.</span>
            <br />
            <span className="text-gradient neon-text">Stay invisible.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Create decentralized invoices and receive payments in SOL without revealing your identity. 
            Permissionless. Borderless. Private.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            {connected ? (
              <Button 
                variant="hero" 
                size="xl" 
                onClick={() => navigate('/create')}
                className="group"
              >
                Create Invoice
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            ) : (
              <WalletMultiButton className="!bg-gradient-to-r !from-primary !to-accent !text-primary-foreground !font-mono !rounded-xl !h-14 !px-10 !text-lg hover:!shadow-[0_0_50px_hsl(var(--primary)/0.6)] !transition-all !border !border-primary/20" />
            )}
            <Button variant="glass" size="xl" onClick={() => navigate('/dashboard')}>
              View Dashboard
            </Button>
          </motion.div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
              className="glass-card p-6 text-center group hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-mono text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
