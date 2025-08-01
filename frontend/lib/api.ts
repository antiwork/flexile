export const API_BASE_URL = (() => "http://api.flexile.dev:3100")();

export const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;

if (!API_SECRET_TOKEN) {
  throw new Error("API_SECRET_TOKEN environment variable is required");
}
