import { geolocation } from "@vercel/functions";
import { headers } from "next/headers";
import React from "react";
import RolePage from "./RolePage";

export default async function Page() {
  const { country } = geolocation({ headers: await headers() });
  return <RolePage countryCode={country || "US"} />;
}
