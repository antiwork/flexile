"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Set } from "immutable";
import { useEffect, useRef, useState } from "react";
import ComboBox from "@/components/ComboBox";
import DecimalInput from "@/components/DecimalInput";
import FormSection from "@/components/FormSection";
import MutationButton from "@/components/MutationButton";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { MAX_FILES_PER_CAP_TABLE_UPLOAD } from "@/models";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";

const BoardMembersSection = () => {
  const company = useCurrentCompany();
  const [administrators] = trpc.companyAdministrators.list.useSuspenseQuery({ companyId: company.id });
  const [boardMemberIds, setBoardMemberIds] = useState(
    Set(administrators.flatMap((admin) => (admin.boardMember ? [admin.id] : []))),
  );
  const updateBoardMembers = trpc.companyAdministrators.update.useMutation();

  const updateMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        administrators.map((admin) =>
          updateBoardMembers.mutateAsync({
            companyId: company.id,
            id: admin.id,
            boardMember: boardMemberIds.has(admin.id),
          }),
        ),
      );
    },
  });

  return (
    <FormSection title="Board members" description="Select company administrators who are board members.">
      <CardContent>
        <div className="grid gap-4">
          Choose board members from your existing administrators.
          <ComboBox
            options={administrators.map((admin) => ({ value: admin.id, label: admin.name }))}
            value={boardMemberIds.toArray()}
            onChange={(value) => setBoardMemberIds(Set(value))}
            multiple
          />
        </div>
      </CardContent>
      <CardFooter>
        <MutationButton mutation={updateMutation} disabled={updateMutation.isPending} loadingText="Saving...">
          Save board members
        </MutationButton>
      </CardFooter>
    </FormSection>
  );
};

export default function Equity() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canCreateCapTableUpload] = trpc.capTableUploads.canCreate.useSuspenseQuery({ companyId: company.id });
  const [{ uploads }] = trpc.capTableUploads.list.useSuspenseQuery({ companyId: company.id });
  const hasInProgressUpload = uploads.length > 0;

  const [sharePriceInUsd, setSharePriceInUsd] = useState(
    company.sharePriceInUsd == null ? null : Number(company.sharePriceInUsd),
  );
  const [conversionSharePriceUsd, setConversionSharePriceUsd] = useState(
    company.conversionSharePriceUsd == null ? null : Number(company.conversionSharePriceUsd),
  );
  const [fmvPerShareInUsd, setFmvPerShareInUsd] = useState(
    company.exercisePriceInUsd == null ? null : Number(company.exercisePriceInUsd),
  );
  const [errors, setErrors] = useState(Set<string>());
  Object.entries({ sharePriceInUsd, fmvPerShareInUsd, conversionSharePriceUsd }).forEach(([key, value]) =>
    useEffect(() => setErrors(errors.delete(key)), [value]),
  );

  const updateSettings = trpc.companies.update.useMutation();
  const saveMutation = useMutation({
    mutationFn: async () => {
      const newErrors = errors.clear().withMutations((errors) => {
        if (!sharePriceInUsd || sharePriceInUsd < 0) errors.add("sharePriceInUsd");
        if (!fmvPerShareInUsd || fmvPerShareInUsd < 0) errors.add("fmvPerShareInUsd");
        if (!conversionSharePriceUsd || conversionSharePriceUsd < 0) errors.add("conversionSharePriceUsd");
      });
      setErrors(newErrors);

      if (!sharePriceInUsd || !fmvPerShareInUsd || !conversionSharePriceUsd || newErrors.size > 0)
        throw new Error("Invalid form data");
      await updateSettings.mutateAsync({
        companyId: company.id,
        sharePriceInUsd: sharePriceInUsd.toString(),
        fmvPerShareInUsd: fmvPerShareInUsd.toString(),
        conversionSharePriceUsd: conversionSharePriceUsd.toString(),
      });
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();
  const createCapTableUpload = trpc.capTableUploads.create.useMutation();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (files.length === 0) throw new Error("No files selected");

      const uploadPromises = files.map(async (file) => {
        const base64Checksum = await md5Checksum(file);
        const { directUploadUrl, key } = await createUploadUrl.mutateAsync({
          isPublic: false,
          filename: file.name,
          byteSize: file.size,
          checksum: base64Checksum,
          contentType: file.type,
        });

        await fetch(directUploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
            "Content-MD5": base64Checksum,
          },
        });

        return key;
      });

      const attachmentKeys = await Promise.all(uploadPromises);
      await createCapTableUpload.mutateAsync({
        companyId: company.id,
        attachmentKeys,
      });
    },
    onSuccess: async () => {
      setFiles([]);
      setFileError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await utils.capTableUploads.canCreate.invalidate();
      await utils.capTableUploads.list.invalidate();
      setTimeout(() => uploadMutation.reset(), 2000);
    },
  });

  return (
    <>
      <FormSection
        title="Equity"
        description="These details will be used for equity-related calculations and reporting."
      >
        <CardContent>
          <div className="grid gap-4">
            <DecimalInput
              value={sharePriceInUsd ?? null}
              onChange={setSharePriceInUsd}
              label="Current share price (USD)"
              invalid={errors.has("sharePriceInUsd")}
              prefix="$"
              minimumFractionDigits={2}
            />
            <DecimalInput
              value={fmvPerShareInUsd ?? null}
              onChange={setFmvPerShareInUsd}
              label="Current 409A valuation (USD per share)"
              invalid={errors.has("fmvPerShareInUsd")}
              prefix="$"
              minimumFractionDigits={2}
            />
            <DecimalInput
              value={conversionSharePriceUsd ?? null}
              onChange={setConversionSharePriceUsd}
              label="Conversion share price (USD)"
              invalid={errors.has("conversionSharePriceUsd")}
              prefix="$"
              minimumFractionDigits={2}
            />
          </div>
        </CardContent>
        <CardFooter>
          <MutationButton mutation={saveMutation} loadingText="Saving..." successText="Changes saved">
            Save changes
          </MutationButton>
        </CardFooter>
      </FormSection>

      <BoardMembersSection />

      {hasInProgressUpload ? (
        <FormSection
          title="Import equity documents"
          description="We are currently processing your equity documents. Please check back later."
        >
          <CardContent>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <p className="text-blue-700">
                Your equity documents are being imported. We will notify you when it is complete.
              </p>
            </div>
          </CardContent>
        </FormSection>
      ) : canCreateCapTableUpload ? (
        <FormSection
          title="Import equity documents"
          description="Upload your cap table, ESOP, or related documents to view your cap table in Flexile or pay contractors with equity."
        >
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cap-table-files">Upload files (maximum {MAX_FILES_PER_CAP_TABLE_UPLOAD} files)</Label>
                <input
                  ref={fileInputRef}
                  id="cap-table-files"
                  type="file"
                  multiple
                  disabled={uploadMutation.isPending}
                  onChange={(e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    if (selectedFiles.length > MAX_FILES_PER_CAP_TABLE_UPLOAD) {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                      setFiles([]);
                      setFileError(`You can only upload up to ${MAX_FILES_PER_CAP_TABLE_UPLOAD} files`);
                      return;
                    }
                    setFileError(null);
                    setFiles(selectedFiles);
                  }}
                />
                {fileError ? <small className="text-red">{fileError}</small> : null}
              </div>
              {files.length > 0 && (
                <div className="grid gap-2">
                  <h3 className="font-medium">Selected files:</h3>
                  <ul className="list-inside list-disc">
                    {files.map((file) => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <MutationButton
              mutation={uploadMutation}
              disabled={files.length === 0 || uploadMutation.isPending}
              loadingText="Uploading..."
              successText="Files uploaded"
            >
              Upload files
            </MutationButton>
          </CardFooter>
        </FormSection>
      ) : null}
    </>
  );
}
