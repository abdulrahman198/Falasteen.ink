/**
 * FALASTEEN.INK — Configuration
 * Environment variables should be set via deployment platform (Netlify, Vercel, etc.)
 * DO NOT commit sensitive keys to version control
 */

// These should come from environment variables, not hardcoded
const SUPABASE_CONFIG = {
  // In Netlify: set as environment variables
  // VITE_SUPABASE_URL=https://audvtdbylhmumvdrhijk.supabase.co
  // VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
  url: window.SUPABASE_URL || (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || '',
  key: window.SUPABASE_ANON_KEY || (typeof process !== 'undefined' && process.env.VITE_SUPABASE_ANON_KEY) || ''
};

const WEB3_CONFIG = {
  chainId: "0x38",
  chainName: "BNB Smart Chain",
  tokenAddress: "0x0C091900bA04376a3AEb0aFC48FAa995c0f1bFCf",
  tokenSymbol: "HANDALA",
  tokenDecimals: 18,
  rpcUrl: "https://bsc-dataseed.binance.org/",
  // Fetch from admin panel or environment variable
  donationAddress: window.DONATION_ADDRESS || ''
};

const LIVEPEER_CONFIG = {
  // Set in Netlify environment variables
  apiKey: window.LIVEPEER_API_KEY || (typeof process !== 'undefined' && process.env.VITE_LIVEPEER_API_KEY) || ''
};

// Validate configuration
if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) {
  console.warn('[CONFIG] Supabase credentials not configured. Some features will be disabled.');
}

// Export as globals
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.WEB3_CONFIG = WEB3_CONFIG;
window.LIVEPEER_CONFIG = LIVEPEER_CONFIG;
