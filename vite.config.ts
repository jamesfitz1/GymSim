import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps every asset path relative, so the built app works from any
// sub-path (GitHub Pages, Netlify, Cloudflare Pages, a plain folder).
export default defineConfig({
  base: './',
  plugins: [react()],
});
