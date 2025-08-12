import { z } from "zod";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { new_company_equity_grant_exercise_path } from "@/utils/routes";

export const useExerciseDataConfig = () => {
  const company = useCurrentCompany();
  return {
    queryKey: ["exerciseData", company.id],
    queryFn: async () => {
      const response = await request({
        url: new_company_equity_grant_exercise_path(company.id),
        accept: "json",
        assertOk: true,
        method: "GET",
      });
      return z.object({ exercise_notice: z.string().nullable() }).parse(await response.json());
    },
  } as const;
};
