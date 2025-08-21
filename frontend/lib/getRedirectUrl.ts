import { navLinks as equityNavLinks } from "@/app/(dashboard)/equity";
import { currentUserSchema } from "@/models/user";
import { assertDefined } from "@/utils/assert";
import { internal_current_user_data_path } from "@/utils/routes";

export const getRedirectUrl = async (req: Request) => {
  const host = assertDefined(req.headers.get("Host"));
  // Use localhost HTTP URL to go through Next.js route handler
  const url = new URL(internal_current_user_data_path(), 'http://localhost:3001');
  const response = await fetch(url.toString(), {
    headers: {
      cookie: req.headers.get("cookie") ?? "",
      "User-Agent": req.headers.get("User-Agent") ?? "",
    },
  });
  if (!response.ok) return "/login";
  const user = currentUserSchema.parse(await response.json());
  if (user.onboardingPath) return user.onboardingPath;

  if (user.roles.administrator) {
    return "/invoices";
  }
  if (user.roles.lawyer) {
    return "/documents";
  }
  if (user.roles.worker) {
    return "/invoices";
  }
  const company = assertDefined(user.companies.find((company) => company.id === user.currentCompanyId));
  return assertDefined(equityNavLinks(user, company)[0]?.route);
};
