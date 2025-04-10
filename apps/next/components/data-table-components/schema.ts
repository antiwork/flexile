import { z } from "zod";
import { PayRateType } from "@/db/enums";


// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
export const expenseSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  payRateInSubunits: z.number(),
  payRateType: z.nativeEnum(PayRateType),
  applicationCount: z.number(),
  activelyHiring: z.boolean()
  // type Role = {
  //   id: string;
  //   name: string;
  //   role:string;
  //   payRateInSubunits: number;
  //   payRateType: PayRateType;
  //   applicationCount: number;
  //   activelyHiring: boolean;
  // };
});

export type Expense = z.infer<typeof expenseSchema>;