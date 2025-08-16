// jest.setup.js
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { resetHandlers, startServer, stopServer } from "./e2e/mocks/server";

// Extend expect with React Testing Library matchers
expect.extend({
  toBeInTheDocument: (received) => {
    const pass =
      received !== null &&
      received !== undefined &&
      received.ownerDocument &&
      received.ownerDocument.contains(received);

    return {
      pass,
      message: () =>
        pass ? `expected ${received} not to be in the document` : `expected ${received} to be in the document`,
    };
  },
});

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: "/",
    query: {},
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} />
  ),
}));

// Mock Stripe.js
jest.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }) => children,
  CardElement: () => <div data-testid="card-element-mock" />,
  useStripe: () => ({
    confirmCardPayment: jest.fn().mockResolvedValue({ paymentIntent: { status: "succeeded" } }),
    confirmBankAccountSetup: jest.fn().mockResolvedValue({ setupIntent: { status: "succeeded" } }),
  }),
  useElements: () => ({
    getElement: jest.fn(),
  }),
}));

// Add TextEncoder and TextDecoder to global (required for some DOM operations)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set up localStorage mock
if (typeof globalThis.window !== "undefined") {
  Object.defineProperty(globalThis.window, "localStorage", {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });
}

// Configure console to fail tests on unhandled errors/rejections
const originalConsoleError = console.error;
console.error = (...args) => {
  // Check if this is a React error that should fail the test
  const errorMessage = args.join(" ");
  if (
    errorMessage.includes("Warning: An update to") ||
    errorMessage.includes("Warning: Cannot update a component") ||
    errorMessage.includes("Warning: Can't perform a React state update")
  ) {
    throw new Error(errorMessage);
  }
  originalConsoleError(...args);
};

// Set up MSW server before all tests
beforeAll(() => {
  // Start the MSW server
  try {
    startServer();
    console.log("🔶 MSW server started for Jest tests");
  } catch (error) {
    console.error("❌ Failed to start MSW server for tests:", error);
    throw error;
  }
});

// Reset handlers between tests
afterEach(() => {
  // Clean up React Testing Library
  cleanup();

  // Reset MSW request handlers to the initial handlers
  resetHandlers();

  // Clear all mocks
  jest.clearAllMocks();
});

// Stop MSW server after all tests
afterAll(() => {
  // Shutdown MSW server
  stopServer();
  console.log("🔶 MSW server stopped after Jest tests");
});

// Global error handling for unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Promise Rejection in tests:", error);
});
