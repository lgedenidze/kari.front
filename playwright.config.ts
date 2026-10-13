import { defineConfig, devices } from "@playwright/test";

// End-to-end tests drive the real web app against the real API and a real PostgreSQL.
//
// They need the throwaway dev database, which is never the hosted one:
//   docker run -d --name kari-dev-db -e POSTGRES_USER=kari -e POSTGRES_DB=kari \
//     -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:54330:5432 postgres:17-alpine
//
// Both servers are started here if they are not already running.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
  },
  webServer: [
    {
      command: "dotnet run --project ../api/src/Kari.Api",
      url: "http://localhost:5080/api/health",
      reuseExistingServer: true,
      timeout: 180_000,
      env: { ConnectionStrings__Kari: "Host=127.0.0.1;Port=54330;Database=kari;Username=kari" },
    },
    {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
