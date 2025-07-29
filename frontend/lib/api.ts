export const API_BASE_URL = (() => {
  switch (process.env.NODE_ENV) {
    case "production":
      return "https://api.flexile.com";
    case "test":
      return "http://api.flexile.dev:3100";
    default:
      return "https://api.flexile.dev";
  }
})();

export const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;

if (!API_SECRET_TOKEN) {
  throw new Error("API_SECRET_TOKEN environment variable is required");
}
