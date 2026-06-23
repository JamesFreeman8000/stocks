import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single-service Vercel deploy: the frontend builds to /dist and the
// /api folder is served by Vercel as serverless functions on the same
// domain. No base path needed (root domain), no CORS needed (same origin).
export default defineConfig({
  plugins: [react()],
  server: {
    // For local dev: proxy /api to your local backend if you run one
    // separately (npm start in the backend). Optional — see README.
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
