import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Browser-safe Solana RPC via same-origin proxy (avoids CORS/blocked fetch).
      // Using Ankr for better rate limits than official Solana endpoints.
      "/rpc/devnet": {
        target: "https://rpc.ankr.com/solana_devnet",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/rpc\/devnet/, ""),
      },
      "/rpc/mainnet": {
        target: "https://rpc.ankr.com/solana",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/rpc\/mainnet/, ""),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: ["@radr/shadowwire"],
  },
  resolve: {
    // Important for linked/local packages (like `file:./ShadowWire`):
    // keep them under `node_modules` so Vite pre-bundles CJS -> ESM correctly.
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
