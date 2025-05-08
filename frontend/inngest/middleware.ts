import { InngestMiddleware } from "inngest";
import superjson from "superjson";

export const superjsonMiddleware = new InngestMiddleware({
  name: "Superjson",
  init() {
    return {
      onFunctionRun() {
        return {
          transformInput({ steps }) {
            const deserializedSteps = steps.map((step) => ({
              ...step,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              data: superjson.deserialize(step.data),
            }));
            return {
              steps: deserializedSteps,
            };
          },
          transformOutput({ result }) {
            return {
              result: {
                data: superjson.serialize(result.data),
              },
            };
          },
        };
      },
    };
  },
});
