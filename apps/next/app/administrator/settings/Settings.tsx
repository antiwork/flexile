"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import ColorPicker from "@/components/ColorPicker";
import FormSection from "@/components/FormSection";
import MutationButton from "@/components/MutationButton";
import { Editor } from "@/components/RichText";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useCurrentCompany } from "@/global";
import defaultLogo from "@/images/default-company-logo.svg";
import { trpc } from "@/trpc/client";
import { isValidUrl, md5Checksum } from "@/utils";
import GithubIntegration from "./GithubIntegration";
import QuickbooksIntegration from "./QuickbooksIntegration";
import StripeMicrodepositVerification from "./StripeMicrodepositVerification";

export default function Settings({ githubOauthUrl }: { githubOauthUrl: string }) {
  const company = useCurrentCompany();
  const [settings, { refetch }] = trpc.companies.settings.useSuspenseQuery({ companyId: company.id });
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      publicName: company.name ?? "",
      website: settings.website ?? "",
      description: settings.description ?? "",
      brandColor: settings.brandColor ?? "",
      showStatsInJobDescriptions: settings.showStatsInJobDescriptions,
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
    mutationFn: async () => {
      const values = form.getValues();
      if (values.website && !isValidUrl(values.website)) {
        form.setError("website", { message: "Invalid URL" });
        throw new Error("Invalid form data");
      }

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
        showStatsInJobDescriptions: values.showStatsInJobDescriptions,
        publicName: values.publicName,
        website: values.website,
        description: values.description,
        brandColor: values.brandColor || null,
      });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  return (
    <>
      <StripeMicrodepositVerification />
      {company.flags.includes("quickbooks") || company.flags.includes("team_updates") ? (
        <FormSection title="Integrations">
          <CardContent>
            {company.flags.includes("quickbooks") ? <QuickbooksIntegration /> : null}
            <Separator className="first:hidden last:hidden" />
            {company.flags.includes("team_updates") ? <GithubIntegration oauthUrl={githubOauthUrl} /> : null}
          </CardContent>
        </FormSection>
      ) : null}
      <FormSection title="Customization" description="These details will be included in job descriptions.">
        <Form {...form}>
          <CardContent>
            <div className="grid gap-4">
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
                      <FormControl>
                        <ColorPicker label="Brand color" value={field.value} onChange={field.onChange} />
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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company description</FormLabel>
                    <FormControl>
                      <Editor value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="showStatsInJobDescriptions"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label={
                          <>
                            Show Team by the numbers in job descriptions
                            <div className="text-xs text-gray-500">
                              Shows live data from your company pulled from Flexile, such as the number of contractors
                              and their average working hours.
                            </div>
                          </>
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>

          <CardFooter>
            <MutationButton mutation={saveMutation} successText="Changes saved" loadingText="Saving...">
              Save changes
            </MutationButton>
          </CardFooter>
        </Form>
      </FormSection>
    </>
  );
}
