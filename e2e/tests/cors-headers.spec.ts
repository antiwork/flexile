import { expect, request, test } from "@playwright/test";

const apiDomain = "http://api.flexile.com";
const appDomain = "http://flexile.com";
const originDomain = "http://example.com";

// This endpoint is from the Rails route: POST /api/v1/user_leads
const apiPath = "/api/v1/user_leads";

// Helper to make requests with custom Host and Origin headers
async function makeRequest({
  url,
  method,
  host,
  origin,
}: {
  url: string;
  method: "GET" | "POST";
  host: string;
  origin: string;
}) {
  const context = await request.newContext();
  const response = await context.fetch(url, {
    method,
    headers: {
      Origin: origin,
      Host: host,
      "Content-Type": "application/json",
    },
    // For POST, send a minimal valid body
    ...(method === "POST" ? { body: JSON.stringify({ email: "test@example.com" }) } : {}),
  });
  await context.dispose();
  return response;
}

test.describe("CORS support", () => {
  test("returns a response with CORS headers for API domain", async () => {
    const response = await makeRequest({
      url: apiDomain + apiPath,
      method: "POST",
      host: "api.flexile.com",
      origin: originDomain,
    });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBe("*");
    expect(headers["access-control-allow-methods"]).toBe("GET, POST, PUT, DELETE");
    expect(headers["access-control-max-age"]).toBe("7200");
  });

  test("returns a response without CORS headers for CORS-disabled domain", async () => {
    const response = await makeRequest({
      url: `${appDomain}/`,
      method: "GET",
      host: "flexile.com",
      origin: originDomain,
    });
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBeUndefined();
    expect(headers["access-control-allow-methods"]).toBeUndefined();
    expect(headers["access-control-max-age"]).toBeUndefined();
  });
});
