import { createSelfSignedCertificate } from "next/dist/lib/mkcert.js";
/* eslint-disable no-console -- suppress output from Next so we can use stdout in bin/dev */
const log = console.log;
console.log = () => {};
const certificate = await createSelfSignedCertificate("flexile.dev", "certificates/flexile.dev");
await createSelfSignedCertificate("api.flexile.dev", "certificates/api.flexile.dev");
log(certificate.rootCA);
