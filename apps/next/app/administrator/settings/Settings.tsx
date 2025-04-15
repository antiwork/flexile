"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import ColorPicker from "@/components/ColorPicker";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MutationButton from "@/components/MutationButton";
import { Editor } from "@/components/RichText";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CardContent, CardFooter } from "@/components/ui/card";
import { HorizontalDivider } from "@/components/ui/divider";
import { Label } from "@/components/ui/label";
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

  const [publicName, setPublicName] = useState(company.name ?? "");
  const [website, setWebsite] = useState(settings.website ?? "");
  const [description, setDescription] = useState(settings.description ?? "");
  const [brandColor, setBrandColor] = useState(settings.brandColor ?? "");
  const [showStatsInJobDescriptions, setShowStatsInJobDescriptions] = useState(settings.showStatsInJobDescriptions);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [websiteHasError, setWebsiteHasError] = useState(false);
  useEffect(() => setWebsiteHasError(false), [website]);

  const logoUrl = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : (company.logo_url ?? defaultLogo.src)),
    [logoFile, company.logo_url],
  );

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const updateSettings = trpc.companies.update.useMutation();
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (website && !isValidUrl(website)) {
        setWebsiteHasError(true);
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
        showStatsInJobDescriptions,
        publicName,
        website,
        description,
        brandColor: brandColor || null,
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
          <CardContent className="px-0">
            {company.flags.includes("quickbooks") ? <QuickbooksIntegration /> : null}
            <HorizontalDivider omit={!company.flags.includes("quickbooks")} />
            {company.flags.includes("team_updates") ? <GithubIntegration oauthUrl={githubOauthUrl} /> : null}
          </CardContent>
        </FormSection>
      ) : null}
      <FormSection title="Customization" description="These details will be included in job descriptions.">
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
              <ColorPicker label="Brand color" value={brandColor} onChange={setBrandColor} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input value={publicName} onChange={setPublicName} label="Company name" />
              <Input value={website} onChange={setWebsite} label="Company website" invalid={websiteHasError} />
            </div>

            <Editor value={description} onChange={setDescription} label="Company description" />

            <Switch
              checked={showStatsInJobDescriptions}
              onCheckedChange={setShowStatsInJobDescriptions}
              label={
                <>
                  Show Team by the numbers in job descriptions
                  <div className="text-xs text-gray-500">
                    Shows live data from your company pulled from Flexile, such as the number of contractors and their
                    average working hours.
                  </div>
                </>
              }
            />
          </div>
        </CardContent>

        <CardFooter>
          <MutationButton mutation={saveMutation} successText="Changes saved" loadingText="Saving...">
            Save changes
          </MutationButton>
        </CardFooter>
      </FormSection>
    </>
  );
}
