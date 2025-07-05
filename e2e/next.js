import fs from "fs";
import { createServer } from "https";
import { parse } from "url";
import next from "next";
import { createSelfSignedCertificate } from "next/dist/lib/mkcert.js";

const app = next({ dir: "frontend" });
const handle = app.getRequestHandler();
await app.prepare();
await createSelfSignedCertificate("localhost");
const options = {
  key: fs.readFileSync("./certificates/localhost-key.pem"),
  cert: fs.readFileSync("./certificates/localhost.pem"),
};
createServer(options, (req, res) => handle(req, res, parse(req.url, true))).listen(3101);
