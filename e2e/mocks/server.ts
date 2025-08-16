// e2e/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Create MSW server instance with our handlers
export const server = setupServer(...handlers);

// Logging configuration
const LOG_PREFIX = "[MSW Server]";
const DEBUG = process.env.MSW_DEBUG === "true";

/**
 * Logs a message if debug mode is enabled
 */
function log(message: string, type: "info" | "warn" | "error" = "info") {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const prefix = `${LOG_PREFIX} [${timestamp}]`;

  switch (type) {
    case "warn":
      console.warn(`${prefix} ⚠️ ${message}`);
      break;
    case "error":
      console.error(`${prefix} 🔴 ${message}`);
      break;
    default:
      console.log(`${prefix} ℹ️ ${message}`);
  }
}

/**
 * Starts the MSW server for E2E tests
 */
export function startServer() {
  try {
    server.listen({
      onUnhandledRequest: (req, print) => {
        // Ignore certain requests that don't need to be mocked
        const ignoredPatterns = [
          // Static assets
          /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot)$/u,
          // Next.js internal
          /\/_next\//u,
          // Internal APIs that don't need mocking
          /\/api\/(?!wise|stripe)/u,
          // Playwright-specific requests
          /\/favicon\.ico/u,
        ];

        if (ignoredPatterns.some((pattern) => pattern.test(req.url))) {
          return;
        }

        // Log unhandled requests to help debug missing mocks
        print.warning();
        log(`Unhandled request: ${req.method} ${req.url}`, "warn");
      },
    });

    log("Server started successfully");

    // Set up error handling
    server.events.on("request:start", ({ request }) => {
      log(`Request started: ${request.method} ${request.url}`);
    });

    server.events.on("response:mocked", ({ request, response }) => {
      log(`Mocked response (${response.status}): ${request.method} ${request.url}`);
    });

    server.events.on("request:unhandled", ({ request }) => {
      log(`Unhandled request: ${request.method} ${request.url}`, "warn");
    });

    server.events.on("request:error", ({ request, error }) => {
      log(`Request error for ${request.method} ${request.url}: ${error.message}`, "error");
    });
  } catch (error) {
    log(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`, "error");
    throw error;
  }
}

/**
 * Stops the MSW server gracefully
 */
export function stopServer() {
  try {
    server.resetHandlers();
    server.close();
    log("Server stopped successfully");
  } catch (error) {
    log(`Failed to stop server: ${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

/**
 * Resets all request handlers to the initial handlers
 */
export function resetHandlers() {
  server.resetHandlers();
  log("Handlers reset to initial state");
}

// Handle process termination gracefully
process.on("SIGTERM", () => {
  log("SIGTERM received, shutting down server", "info");
  stopServer();
});

process.on("SIGINT", () => {
  log("SIGINT received, shutting down server", "info");
  stopServer();
});
