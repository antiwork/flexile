import { createServer } from "http";
import { parse } from "url";
import next from "next";

const app = next({ dir: "frontend" });
const handle = app.getRequestHandler();
await app.prepare();
createServer((req, res) => handle(req, res, parse(req.url, true))).listen(3101);
