// @ts-check
const { defineConfig } = require('@playwright/test');

const port = Number(process.env.PLAYWRIGHT_PORT || 3000);

module.exports = defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  timeout: 15000,
  use: {
    baseURL: `http://localhost:${port}`,
    headless: true,
  },
  webServer: {
    command: 'node server.js',
    env: { ...process.env, PORT: String(port) },
    port,
    reuseExistingServer: process.env.PLAYWRIGHT_NO_REUSE_SERVER !== '1',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
