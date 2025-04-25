import { redirect } from "next/navigation";

export default async function Page() {
  await Promise.resolve(); // Add await expression to satisfy ESLint
  redirect("/");
}
