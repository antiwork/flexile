"use client";

import { useCurrentUser } from "@/global";
import AdminList from "./AdminList";
import ViewList from "./ViewList";

export default function InvoicesPage() {
  const user = useCurrentUser();

  return (!!user.roles.worker || !!user.roles.investor) ? <ViewList /> : <AdminList />;
}
