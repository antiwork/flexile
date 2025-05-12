"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Set } from "immutable";
import { useId, useRef, useState } from "react";
import ComboBox from "@/components/ComboBox";
import MutationButton, { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Label } from "@/components/ui/label";
import { useCurrentCompany } from "@/global";
import { MAX_FILES_PER_CAP_TABLE_UPLOAD } from "@/models";
import { trpc } from "@/trpc/client";
import { md5Checksum } from "@/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";

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
    <div className="grid gap-4">
      <hgroup>
        <h2 className="text-xl font-medium">Board members</h2>
        <p className="text-sm text-gray-500">Select company administrators who are board members.</p>
      </hgroup>
      <ComboBox
        options={administrators.map((admin) => ({ value: admin.id, label: admin.name }))}
        value={boardMemberIds.toArray()}
        onChange={(value) => setBoardMemberIds(Set(value))}
        multiple
      />
      <MutationButton
        mutation={updateMutation}
        disabled={updateMutation.isPending}
        loadingText="Saving..."
        className="justify-self-end"
      >
        Save board members
      </MutationButton>
    </div>
  );
};

const formSchema = z.object({
  sharePriceInUsd: z.number().min(0),
  fmvPerShareInUsd: z.number().min(0),
  conversionSharePriceUsd: z.number().min(0),
});

export default function Equity() {
  const company = useCurrentCompany();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const uid = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [{ uploads }] = trpc.capTableUploads.list.useSuspenseQuery({ companyId: company.id });
  const hasInProgressUpload = uploads.length > 0;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...(company.sharePriceInUsd ? { sharePriceInUsd: Number(company.sharePriceInUsd) } : {}),
      ...(company.exercisePriceInUsd ? { fmvPerShareInUsd: Number(company.exercisePriceInUsd) } : {}),
      ...(company.conversionSharePriceUsd ? { conversionSharePriceUsd: Number(company.conversionSharePriceUsd) } : {}),
    },
  });

  const updateSettings = trpc.companies.update.useMutation({
    onSuccess: async () => {
      await utils.companies.settings.invalidate();
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setTimeout(() => updateSettings.reset(), 2000);
    },
  });
  const submit = form.handleSubmit((values) =>
    updateSettings.mutateAsync({
      companyId: company.id,
      sharePriceInUsd: values.sharePriceInUsd.toString(),
      fmvPerShareInUsd: values.fmvPerShareInUsd.toString(),
      conversionSharePriceUsd: values.conversionSharePriceUsd.toString(),
    }),
  );

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
      await utils.capTableUploads.list.invalidate();
      setTimeout(() => uploadMutation.reset(), 2000);
    },
  });

  return (
    <>
      <Form {...form}>
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <hgroup>
            <h2 className="text-xl font-medium">Equity</h2>
            <p className="text-sm text-gray-500">
              These details will be used for equity-related calculations and reporting.
            </p>
          </hgroup>
          <FormField
            control={form.control}
            name="sharePriceInUsd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current share price (USD)</FormLabel>
                <FormControl>
                  <NumberInput {...field} decimal minimumFractionDigits={2} prefix="$" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fmvPerShareInUsd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current 409A valuation (USD per share)</FormLabel>
                <FormControl>
                  <NumberInput {...field} decimal minimumFractionDigits={2} prefix="$" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="conversionSharePriceUsd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conversion share price (USD)</FormLabel>
                <FormControl>
                  <NumberInput {...field} decimal minimumFractionDigits={2} prefix="$" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <MutationStatusButton
            type="submit"
            className="justify-self-end"
            mutation={updateSettings}
            loadingText="Saving..."
            successText="Changes saved"
          >
            Save changes
          </MutationStatusButton>
        </form>
      </Form>

      <Separator />

      <BoardMembersSection />

      <Separator />

      <hgroup>
        <h2 className="text-xl font-medium">Import equity documents</h2>
        {hasInProgressUpload ? null : (
          <p className="text-sm text-gray-500">
            Upload your cap table, ESOP, or related documents to view your cap table in Flexile or pay contractors with
            equity
          </p>
        )}
      </hgroup>
      {hasInProgressUpload ? (
        <Alert>
          <AlertTitle>Your equity documents are being imported. We will notify you when it is complete.</AlertTitle>
        </Alert>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`cap-table-files-${uid}`}>
              Upload files (maximum {MAX_FILES_PER_CAP_TABLE_UPLOAD} files)
            </Label>
            <input
              ref={fileInputRef}
              id={`cap-table-files-${uid}`}
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
          <MutationButton
            mutation={uploadMutation}
            disabled={files.length === 0 || uploadMutation.isPending}
            loadingText="Uploading..."
            successText="Files uploaded"
          >
            Upload files
          </MutationButton>
        </div>
      )}
    </>
  );
}
