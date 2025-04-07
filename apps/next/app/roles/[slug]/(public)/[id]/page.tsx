import { geolocation } from "@vercel/functions";
import { headers } from "next/headers";
import RolePage from "./RolePage";
import React from "react";

export default async function Page() {
  const { country } = geolocation({ headers: await headers() });
  return <RolePage countryCode={country || "US"} />;
}
