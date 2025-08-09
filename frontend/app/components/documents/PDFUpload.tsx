"use client";

import { trpc } from "@/app/_trpc/client";
import { useState } from "react";

interface PDFUploadProps {
  onUploadComplete: (result: { documentId: bigint; fileStorageKey: string }) => void;
  isTemplate?: boolean;
}

export function PDFUpload({ onUploadComplete, isTemplate = false }: PDFUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.documents.internal.upload.useMutation({
    onSuccess: (result) => {
      onUploadComplete(result);
      setFile(null);
      setUploading(false);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      setUploading(false);
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1]; // Remove data:application/pdf;base64, prefix

      uploadMutation.mutate({
        name: file.name.replace('.pdf', ''),
        file: base64Data,
        isTemplate,
        type: 0, // DocumentType.ConsultingContract for now
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <div className="text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="mt-2 block text-sm font-medium text-gray-900">
              {file ? file.name : `Upload ${isTemplate ? 'template' : 'document'} PDF`}
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept=".pdf"
              className="sr-only"
              onChange={handleFileSelect}
            />
          </label>
        </div>
        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload PDF'}
          </button>
        )}
      </div>
    </div>
  );
}
