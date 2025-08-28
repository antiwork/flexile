import type { Route } from "next";

export function isValidRoute(value: string | null | undefined): value is Route {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}
