import { z } from "zod";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { company_template_path } from "@/utils/routes";

export const templateTypes = [
  "exercise_notice",
  "consulting_contract",
  "letter_of_transmittal",
  "stock_option_agreement",
] as const;
export type TemplateType = (typeof templateTypes)[number];
export const templateTypeNames = {
  exercise_notice: { name: "Exercise notice", usedFor: "Options" },
  consulting_contract: { name: "Consulting agreement", usedFor: "Contracts" },
  letter_of_transmittal: { name: "Letter of transmittal", usedFor: "Buybacks" },
  stock_option_agreement: { name: "Stock option agreement", usedFor: "Grants" },
} as const;

export const useDocumentTemplateQuery = (type: TemplateType) => {
  const company = useCurrentCompany();
  return {
    queryKey: ["templates", company.id, type],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: company_template_path(company.id, type),
        accept: "json",
      });
      if (!response.ok) return { text: null };
      return (
        z
          .object({ text: z.string() })
          .nullable()
          .parse(await response.json()) || { text: null }
      );
    },
  } as const;
};
