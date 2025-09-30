import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatISO } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import {
  DialogStack,
  DialogStackBody,
  DialogStackContent,
  DialogStackFooter,
  DialogStackHeader,
  DialogStackNext,
  DialogStackPrevious,
  DialogStackTitle,
} from "@/components/ui/dialog-stack";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import { PayRateType, trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_workers_path } from "@/utils/routes";
import NewDocumentField, { schema as documentSchema } from "../documents/NewDocumentField";
import FormFields, { schema as formSchema } from "./FormFields";

const removeMailtoPrefix = (email: string) => email.replace(/^mailto:/iu, "");

const inviteSchema = formSchema.merge(documentSchema).extend({
  email: z.string().email(),
  startDate: z.instanceof(CalendarDate),
  contractSignedElsewhere: z.boolean().default(false),
});

const InviteModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();

  const { data: workers = [], refetch } = trpc.contractors.list.useQuery({ companyId: company.id });
  const lastContractor = workers[0];
  const inviteForm = useForm({
    values: {
      email: "",
      role: lastContractor?.role ?? "",
      payRateType: lastContractor?.payRateType ?? PayRateType.Hourly,
      payRateInSubunits: lastContractor?.payRateInSubunits ?? null,
      startDate: today(getLocalTimeZone()),
      contractSignedElsewhere: lastContractor?.contractSignedElsewhere ?? false,
      contract: "",
    },
    resolver: zodResolver(inviteSchema),
  });
  const inviteMutation = useMutation({
    mutationFn: async (values: z.infer<typeof inviteSchema>) => {
      const formData = new FormData();
      formData.append("contractor[email]", values.email);
      formData.append("contractor[started_at]", formatISO(values.startDate.toDate(getLocalTimeZone())));
      formData.append("contractor[pay_rate_in_subunits]", values.payRateInSubunits?.toString() ?? "");
      formData.append(
        "contractor[pay_rate_type]",
        values.payRateType === PayRateType.Hourly ? "hourly" : "project_based",
      );
      formData.append("contractor[role]", values.role);
      formData.append("contractor[contract_signed_elsewhere]", values.contractSignedElsewhere.toString());
      formData.append("contractor[contract]", values.contract);

      const response = await request({
        url: company_workers_path(company.id),
        method: "POST",
        accept: "json",
        assertOk: true,
        formData,
      });

      if (!response.ok) {
        const json = z.object({ error_message: z.string() }).parse(await response.json());
        throw new Error(json.error_message);
      }
    },
    onSuccess: async () => {
      await refetch();
      onOpenChange(false);
      inviteForm.reset();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
  const submit = inviteForm.handleSubmit((values) => inviteMutation.mutate(values));

  return (
    <DialogStack open={open} onOpenChange={onOpenChange}>
      <Form {...inviteForm}>
        <DialogStackBody>
          <DialogStackContent>
            <DialogStackHeader>
              <DialogStackTitle>Who's joining?</DialogStackTitle>
            </DialogStackHeader>
            <FormField
              control={inviteForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Contractor's email"
                      onChange={(e) => field.onChange(removeMailtoPrefix(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={inviteForm.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DatePicker {...field} label="Start date" granularity="day" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormFields />
            <DialogStackFooter>
              <DialogStackNext>
                <Button>Continue</Button>
              </DialogStackNext>
            </DialogStackFooter>
          </DialogStackContent>
          <DialogStackContent>
            <DialogStackHeader>
              <DialogStackTitle>Add a contract</DialogStackTitle>
            </DialogStackHeader>
            <form onSubmit={(e) => void submit(e)} className="contents">
              {!inviteForm.watch("contractSignedElsewhere") && <NewDocumentField type="consulting_contract" />}

              <FormField
                control={inviteForm.control}
                name="contractSignedElsewhere"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label="Already signed contract elsewhere"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {inviteMutation.isError ? <div className="text-red text-sm">{inviteMutation.error.message}</div> : null}
              <DialogStackFooter>
                <DialogStackPrevious>
                  <Button variant="outline">Back</Button>
                </DialogStackPrevious>
                <MutationStatusButton mutation={inviteMutation} type="submit">
                  Send invite
                </MutationStatusButton>
              </DialogStackFooter>
            </form>
          </DialogStackContent>
        </DialogStackBody>
      </Form>
    </DialogStack>
  );
};

export default InviteModal;
