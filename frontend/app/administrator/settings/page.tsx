"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pick } from "lodash-es";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ColorPicker from "@/components/ColorPicker";
import { MutationStatusButton } from "@/components/MutationButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";
import QuickbooksIntegration from "./QuickbooksIntegration";
import StripeMicrodepositVerification from "./StripeMicrodepositVerification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  website: z.string().url(),
  brandColor: z.string().nullable(),
  publicName: z.string(),
});
export default function SettingsPage() {
  const company = useCurrentCompany();
  const [settings, { refetch }] = trpc.companies.settings.useSuspenseQuery({ companyId: company.id });
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      publicName: company.name ?? "",
      ...pick(settings),
    },
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : (company.logo_url ?? defaultLogo.src)),
    [logoFile, company.logo_url],
  );

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const updateSettings = trpc.companies.update.useMutation();
  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      let logoKey: string | undefined = undefined;
      if (logoFile) {
        const base64Checksum = await md5Checksum(logoFile);
        const { directUploadUrl, key } = await createUploadUrl.mutateAsync({
          isPublic: true,
          filename: logoFile.name,
          byteSize: logoFile.size,
          checksum: base64Checksum,
          contentType: logoFile.type,
        });

        await fetch(directUploadUrl, {
          method: "PUT",
          body: logoFile,
          headers: {
            "Content-Type": logoFile.type,
            "Content-MD5": base64Checksum,
          },
        });

        logoKey = key;
      }
      await updateSettings.mutateAsync({
        companyId: company.id,
        logoKey,
        ...values,
        brandColor: values.brandColor || null,
      });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <>
      <StripeMicrodepositVerification />
      {company.flags.includes("quickbooks") ? (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent>{company.flags.includes("quickbooks") ? <QuickbooksIntegration /> : null}</CardContent>
        </Card>
      ) : null}
      <Form {...form}>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <div>Logo</div>
              <Label className="flex cursor-pointer items-center">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  aria-label="Logo"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setLogoFile(e.target.files[0]);
                    }
                  }}
                />
                <Avatar className="size-12 rounded-md">
                  <AvatarImage src={logoUrl} alt="Company logo" />
                  <AvatarFallback>Logo</AvatarFallback>
                </Avatar>
                <span className="ml-2">Upload...</span>
              </Label>
            </div>
            <FormField
              control={form.control}
              name="brandColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand color</FormLabel>
                  <FormControl>
                    <ColorPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={form.control}
              name="publicName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company website</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <MutationStatusButton
            mutation={saveMutation}
            type="submit"
            successText="Changes saved"
            loadingText="Saving..."
            className="justify-self-end"
          >
            Save changes
          </MutationStatusButton>
        </form>
      </Form>
    </>
  );
}
