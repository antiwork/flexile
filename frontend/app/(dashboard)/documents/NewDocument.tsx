import { zodResolver } from "@hookform/resolvers/zod";
import { skipToken, useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ComboBox from "@/components/ComboBox";
import ContractField, { schema as contractSchema } from "@/components/ContractField";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCurrentCompany } from "@/global";
import { DocumentType, trpc } from "@/trpc/client";
import { request } from "@/utils/request";
import { company_documents_path } from "@/utils/routes";

const schema = contractSchema.extend({
  recipient: z.string().optional(),
  type: z.enum([DocumentType.ConsultingContract.toString(), DocumentType.EquityPlanContract.toString()]),
});

const documentTypeOptions = [
  { value: DocumentType.ConsultingContract.toString(), label: "Agreement" },
  { value: DocumentType.EquityPlanContract.toString(), label: "Equity plan" },
];

export const NewDocument = () => {
  const company = useCurrentCompany();
  const [open, setOpen] = useState(false);

  const trpcUtils = trpc.useUtils();

  const { data: recipients } = trpc.contractors.list.useQuery(
    company.id ? { companyId: company.id, excludeAlumni: true } : skipToken,
  );

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: DocumentType.ConsultingContract.toString(),
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      const { attachment, type, recipient, title, content } = data;
      const url = company_documents_path(company.id);

      let signed = data.signed;
      if (type === DocumentType.EquityPlanContract.toString()) {
        signed = false;
      }

      if (attachment) {
        const formData = new FormData();
        formData.append("attachment", attachment);
        formData.append("name", attachment.name);
        formData.append("document_type", String(type));
        formData.append("signed", String(signed));
        if (recipient) formData.append("recipient", recipient);

        await request({ url, method: "POST", accept: "json", formData, assertOk: true });
      } else {
        const jsonData = {
          document_type: type,
          name: title,
          text_content: content,
          recipient,
        };

        await request({ url, method: "POST", accept: "json", jsonData, assertOk: true });
      }
    },
    onSuccess: async () => {
      await trpcUtils.documents.list.refetch();
      form.reset();
      setOpen(false);
    },
  });

  const submit = form.handleSubmit((data) => {
    createDocumentMutation.mutate(data);
  });

  return (
    <>
      <Button variant="outline" size="small" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New Document
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
            <DialogDescription>Choose how you'd like to add your document</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={(e) => void submit(e)} className="grid gap-6">
              <ContractField />
              <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient</FormLabel>
                    <FormControl>
                      <ComboBox
                        {...field}
                        options={
                          recipients
                            ? recipients.map((r) => ({
                                value: r.id,
                                label: r.user.name,
                              }))
                            : []
                        }
                        placeholder="Select recipient"
                      />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>Leave blank to create without sending</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document type</FormLabel>
                    <FormControl>
                      <ComboBox
                        value={field.value.toString()}
                        onChange={(value) => form.setValue("type", value)}
                        options={documentTypeOptions}
                        placeholder="Select document type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                {createDocumentMutation.error ? (
                  <p className="text-red-500">{createDocumentMutation.error.message}</p>
                ) : null}
                <MutationStatusButton type="submit" mutation={createDocumentMutation} loadingText="Creating...">
                  Create
                </MutationStatusButton>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
};
