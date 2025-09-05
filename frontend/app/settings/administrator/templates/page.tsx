"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { z } from "zod";
import { templateTypeNames, templateTypes } from "@/app/(dashboard)/documents";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";
import { company_templates_path } from "@/utils/routes";
import { formatDate } from "@/utils/time";

export default function Details() {
  const company = useCurrentCompany();
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
            const { name, usedFor } = templateTypeNames[type];
            const template = templates.find((template) => template.document_type === type);
            return (
              <TableRow key={type}>
                <TableCell>
                  <Link href={`/settings/administrator/templates/${type}`} className="after:absolute after:inset-0">
                    {name}
                  </Link>
                </TableCell>
                <TableCell>{usedFor}</TableCell>
                <TableCell>{template ? formatDate(template.updated_at) : "-"}</TableCell>
                <TableCell className="h-14">{template ? null : <Button>Add</Button>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
