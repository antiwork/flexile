import { redirect } from "next/navigation";
import { getRedirectUrl } from "@/lib/getRedirectUrl";
import { isValidRoute } from "@/utils/nextHelpers";

export async function GET(req: Request) {
  const redirectUrl = await getRedirectUrl(req);
  return redirect(isValidRoute(redirectUrl) ? redirectUrl : "/invoices");
}
