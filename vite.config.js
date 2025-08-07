import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Removed proxy configuration as we're using Netlify Functions
  },
  // Define environment variables for different builds
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  build: {
    outDir: 'dist',
    // Disable sourcemaps for production for smaller bundle size
    sourcemap: false,
    // Optimize for production
    minify: 'terser',
    target: 'esnext',
    rollupOptions: {
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          animations: ['framer-motion', 'canvas-confetti'],
        },
        // Clean filenames for production
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
    },
    // Set chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'canvas-confetti'],
  },
});