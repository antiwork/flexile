import { redirect } from "next/navigation";
import { getRedirectUrl } from "@/lib/getRedirectUrl";

export async function GET(req: Request) {
  const redirectUrl = await getRedirectUrl(req);
  return redirect(redirectUrl);
}
