import { EventSchemas, Inngest } from "inngest";
import { superjsonMiddleware } from "./middleware";

export const inngest = new Inngest({
  id: "flexile",
  schemas: new EventSchemas().fromZod({}),
  middleware: [superjsonMiddleware],
});
