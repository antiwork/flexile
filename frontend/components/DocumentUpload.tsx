"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle, Cloud, FileText, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/trpc/client";
import { cn, md5Checksum } from "@/utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
];

const fileValidationSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "File size must be less than 50MB",
    })
    .refine(
      (file) => ALLOWED_FILE_TYPES.includes(file.type) || file.name.endsWith(".doc") || file.name.endsWith(".docx"),
      {
        message: "File type not supported. Please upload PDF, DOC, DOCX, XLS, XLSX, TXT, or ZIP files",
      },
    ),
});

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface UploadedFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  key?: string;
}

interface DocumentUploadProps {
  onUploadComplete?: (files: UploadedFile[]) => void;
  onSignedChange?: (signed: boolean) => void;
  className?: string;
}

const getFileIcon = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return <FileText className="size-5 text-orange-500" />;
    case "doc":
    case "docx":
      return <FileText className="size-5 text-blue-500" />;
    case "xls":
    case "xlsx":
      return <FileText className="size-5 text-green-500" />;
    case "txt":
      return <FileText className="size-5 text-gray-500" />;
    case "zip":
      return <FileText className="size-5 text-purple-500" />;
    default:
      return <FileText className="size-5 text-gray-500" />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const generateFileId = () => Math.random().toString(36).substring(2, 15);

export const DocumentUpload = ({ onUploadComplete, onSignedChange, className }: DocumentUploadProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [markAsSigned, setMarkAsSigned] = useState(false);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();

  const uploadFile = useMutation({
    mutationFn: async (uploadedFile: UploadedFile) => {
      const { file } = uploadedFile;

      // Validate file
      const validation = fileValidationSchema.safeParse({ file });
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        throw new Error(firstError?.message ?? "Validation failed");
      }

      // Generate checksum
      const base64Checksum = await md5Checksum(file);

      // Create upload URL
      const { directUploadUrl, key } = await createUploadUrl.mutateAsync({
        isPublic: false,
        filename: file.name,
        byteSize: file.size,
        checksum: base64Checksum,
        contentType: file.type,
      });

      // Upload file to S3
      const response = await fetch(directUploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
          "Content-MD5": base64Checksum,
        },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return { key, uploadedFile };
    },
    onMutate: (uploadedFile) => {
      setUploadedFiles((prev) =>
        prev.map((file) =>
          file.id === uploadedFile.id ? { ...file, status: "uploading" as const, progress: 0 } : file,
        ),
      );
    },
    onSuccess: ({ key, uploadedFile }) => {
      setUploadedFiles((prev) =>
        prev.map((file) =>
          file.id === uploadedFile.id ? { ...file, status: "success" as const, progress: 100, key } : file,
        ),
      );
    },
    onError: (error, uploadedFile) => {
      setUploadedFiles((prev) =>
        prev.map((file) =>
          file.id === uploadedFile.id ? { ...file, status: "error" as const, error: error.message } : file,
        ),
      );
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const newUploadedFiles: UploadedFile[] = files.map((file) => ({
        id: generateFileId(),
        file,
        status: "idle" as const,
        progress: 0,
      }));

      setUploadedFiles((prev) => [...prev, ...newUploadedFiles]);

      // Start uploading each file
      newUploadedFiles.forEach((uploadedFile) => {
        uploadFile.mutate(uploadedFile);
      });
    },
    [uploadFile],
  );

  const retryUpload = useCallback(
    (uploadedFile: UploadedFile) => {
      uploadFile.mutate(uploadedFile);
    },
    [uploadFile],
  );

  const removeFile = useCallback((id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

  const handleUploadComplete = useCallback(() => {
    const successfulFiles = uploadedFiles.filter((file) => file.status === "success");
    if (successfulFiles.length > 0 && onUploadComplete) {
      onUploadComplete(successfulFiles);
    }
  }, [uploadedFiles, onUploadComplete]);

  const handleSignedChange = useCallback(
    (checked: boolean | "indeterminate") => {
      const isChecked = checked === true;
      setMarkAsSigned(isChecked);
      if (onSignedChange) {
        onSignedChange(isChecked);
      }
    },
    [onSignedChange],
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Cloud className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <p className="text-muted-foreground mb-2 text-sm">
          Drag and drop or{" "}
          <label className="text-primary cursor-pointer hover:underline">
            click to browse
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={handleFileInput}
            />
          </label>{" "}
          your files here
        </p>
        <p className="text-muted-foreground text-xs">PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP (max 50MB each)</p>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-3">
          {uploadedFiles.map((uploadedFile) => (
            <div
              key={uploadedFile.id}
              className={cn(
                "rounded-lg border p-4 transition-colors",
                uploadedFile.status === "error" && "border-red-200 bg-red-50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    {getFileIcon(uploadedFile.file.name)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="truncate font-medium">{uploadedFile.file.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {formatFileSize(uploadedFile.file.size)} - SHA256:{uploadedFile.id.substring(0, 8)}
                    </div>
                    {uploadedFile.status === "error" && (
                      <div className="mt-1 text-sm text-red-600">
                        {uploadedFile.error || "Upload failed. Please try again."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {uploadedFile.status === "uploading" && (
                    <>
                      <div className="text-muted-foreground text-sm">{uploadedFile.progress}%</div>
                      <div className="w-20">
                        <Progress value={uploadedFile.progress} className="h-2" />
                      </div>
                    </>
                  )}

                  {uploadedFile.status === "success" && <CheckCircle className="size-5 text-green-500" />}

                  {uploadedFile.status === "error" && (
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => retryUpload(uploadedFile)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => removeFile(uploadedFile.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mark as Signed Checkbox */}
      {uploadedFiles.length > 0 && (
        <div className="flex items-center space-x-2">
          <Checkbox id="mark-as-signed" checked={markAsSigned} onCheckedChange={handleSignedChange} />
          <label
            htmlFor="mark-as-signed"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Mark this document as signed
          </label>
        </div>
      )}

      {/* Upload Complete Button */}
      {uploadedFiles.some((file) => file.status === "success") && (
        <div className="flex justify-end">
          <Button onClick={handleUploadComplete}>
            <Upload className="mr-2 size-4" />
            Complete upload
          </Button>
        </div>
      )}
    </div>
  );
};
