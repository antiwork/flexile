import fs from "fs";
import { createServer } from "https";
import { parse } from "url";
import next from "next";

const app = next({ dir: "frontend" });
const handle = app.getRequestHandler();
await app.prepare();
const options = {
  key: fs.readFileSync("./test_flexile_dev.key"),
  cert: fs.readFileSync("./test_flexile_dev.crt"),
};
createServer(options, (req, res) => handle(req, res, parse(req.url, true))).listen(3101);
