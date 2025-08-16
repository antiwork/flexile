// jest.polyfills.js
//
// This file is loaded by Jest before any test modules, ensuring
// web APIs required by MSW are available in the Node.js environment.

// ---------------------------------------------------------------------------
// Fetch / Request / Response / Headers
// ---------------------------------------------------------------------------
// Import whatwg-fetch polyfill to ensure fetch APIs are available
import "whatwg-fetch";

// Import streams polyfill for TransformStream, ReadableStream, etc.
// Needed by MSW's internal brotli-decompression helpers.
import "web-streams-polyfill/polyfill";

// Import necessary polyfills for MSW
import { TextDecoder, TextEncoder } from "util";
global.TextEncoder ||= TextEncoder;
global.TextDecoder ||= TextDecoder;

// Ensure URL constructor is available
// (Node.js 18+ has it natively, but we ensure it's available)
if (!global.URL) {
  global.URL = URL;
}

// Ensure FormData is available
if (!global.FormData) {
  // Simple FormData polyfill for tests
  class FormDataPolyfill {
    constructor() {
      this.data = new Map();
    }
    append(key, value) {
      this.data.set(key, value);
    }
    get(key) {
      return this.data.get(key);
    }
    getAll() {
      return Array.from(this.data.entries());
    }
    has(key) {
      return this.data.has(key);
    }
    delete(key) {
      this.data.delete(key);
    }
  }
  global.FormData = FormDataPolyfill;
}

// ---------------------------------------------------------------------------
// BroadcastChannel
// ---------------------------------------------------------------------------
// MSW's WebSocket fallback relies on BroadcastChannel in the Node test
// environment.  Provide a minimal no-op implementation sufficient for MSW.
/* istanbul ignore next */
if (!global.BroadcastChannel) {
  class BroadcastChannelPolyfill extends EventTarget {
    constructor(name) {
      super();
      this.name = name;
    }

    // Dispatch a message event; listeners can inspect `event.data`.
    postMessage(message) {
      const event = new Event("message");
      // Non-standard: attach `data` like in the real API so MSW can read it
      // eslint-disable-next-line no-param-reassign
      event.data = message;
      this.dispatchEvent(event);
    }

    // Close the channel – no-op for the polyfill.
    close() {
      /* no-op */
    }
  }

  global.BroadcastChannel = BroadcastChannelPolyfill;
}

// Log successful polyfill initialization
// eslint-disable-next-line no-console
console.log("✅ Web API polyfills loaded for MSW");
