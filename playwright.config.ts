import { defineConfig, devices } from '@playwright/test'

/**
 * Browser checks run the real app against an in-memory Supabase stand-in
 * (e2e/support/mockSupabase.ts): no database, no network, safe for CI.
 * The app is a production build (vite build + preview), so timings in
 * e2e/feedback.spec.ts are what users get, not React's development mode.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
    locale: 'en-GB',
    timezoneId: 'Asia/Tashkent',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'https://jltrtqwaxvsrnqmjemzc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
