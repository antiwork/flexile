"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  type TemplateType,
  templateTypeNames,
  templateTypes,
  useDocumentTemplateQuery,
} from "@/app/(dashboard)/documents";
import { MutationStatusButton } from "@/components/MutationButton";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { company_template_path, company_templates_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";

export default function Templates() {
  const company = useCurrentCompany();
  const [editingTemplate, setEditingTemplate] = useQueryState("edit", parseAsStringLiteral(templateTypes));
  const { data: templates } = useSuspenseQuery({
    queryKey: ["templates", company.id],
    queryFn: async () => {
      const response = await request({
        method: "GET",
        url: company_templates_path(company.id),
        accept: "json",
        assertOk: true,
      });
      return z
        .array(z.object({ document_type: z.enum(templateTypes), updated_at: z.string() }))
        .parse(await response.json());
    },
  });

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Templates</h2>
        <p className="text-muted-foreground text-base">
          Create and edit legal document templates with rich-text editing, linked to the right events in your account.
        </p>
      </hgroup>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Used for</TableHead>
            <TableHead>Last edited</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {templateTypes.map((type) => {
            switch (type) {
              case "exercise_notice":
                if (!company.flags.includes("option_exercising")) return null;
                break;
              case "stock_option_agreement":
              case "letter_of_transmittal":
                if (!company.equityEnabled) return null;
                break;
              default:
                break;
            }
            const { name, usedFor } = templateTypeNames[type];
            const template = templates.find((template) => template.document_type === type);
            return (
              <TableRow key={type} onClick={() => void setEditingTemplate(type)} className="cursor-pointer">
                <TableCell>{name}</TableCell>
                <TableCell>{usedFor}</TableCell>
                <TableCell>{template ? formatDate(template.updated_at) : "-"}</TableCell>
                <TableCell className="h-14">{template ? null : <Button size="small">Add</Button>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editingTemplate ? <EditTemplate type={editingTemplate} onClose={() => void setEditingTemplate(null)} /> : null}
    </div>
  );
}

const formSchema = z.object({ text: z.string().nullable() });

function EditTemplate({ type, onClose }: { type: TemplateType; onClose: () => void }) {
  const company = useCurrentCompany();
  const queryClient = useQueryClient();

  const { name } = templateTypeNames[type];
  const { data: template } = useSuspenseQuery(useDocumentTemplateQuery(type));
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { text: template.text },
  });
  const submitMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      await request({
        method: "PUT",
        url: company_template_path(company.id, type),
        jsonData: values,
        accept: "json",
      });
      await queryClient.invalidateQueries({ queryKey: ["templates", company.id] });
      onClose();
    },
  });
  const submit = form.handleSubmit((values) => submitMutation.mutate(values));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-screen-lg">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <Form {...form}>
            <FormField control={form.control} name="text" render={({ field }) => <RichTextEditor {...field} />} />
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <MutationStatusButton
                type="submit"
                mutation={submitMutation}
                loadingText="Saving..."
                successText="Changes saved"
              >
                Save changes
              </MutationStatusButton>
            </DialogFooter>
          </Form>
        </form>
      </DialogContent>
    </Dialog>
  );
}
