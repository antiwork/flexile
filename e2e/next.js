import fs from "fs";
import { createServer } from "https";
import process from "node:process";
import { parse } from "url";
import next from "next";
import { createSelfSignedCertificate } from "next/dist/lib/mkcert.js";

// Get test domain from environment or use default
const testDomain = process.env.FLEXILE_TEST_DOMAIN || process.env.TEST_DOMAIN || "test.flexile.dev";

const app = next({ dir: "frontend" });
const handle = app.getRequestHandler();
await app.prepare();
await createSelfSignedCertificate(testDomain);
const options = {
  key: fs.readFileSync("./certificates/localhost-key.pem"),
  cert: fs.readFileSync("./certificates/localhost.pem"),
};
createServer(options, (req, res) => handle(req, res, parse(req.url, true))).listen(3101);
