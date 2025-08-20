import { CloudUpload, PencilLine, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import { linkClasses } from "@/components/Link";
import Placeholder from "@/components/Placeholder";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFileSize } from "@/utils";

export const schema = z.object({
  contract: z.string().min(1).or(z.instanceof(File)),
});

export default function NewDocumentField() {
  const form = useFormContext<z.infer<typeof schema>>();
  const [contractType, setContractType] = useState("upload");
  const value = form.watch("contract");
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => form.setValue("contract", ""), [contractType]);

  return (
    <FormField
      control={form.control}
      name="contract"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Contract</FormLabel>

          <Tabs value={contractType} onValueChange={setContractType}>
            <TabsList className="w-full">
              <TabsTrigger value="upload">
                <CloudUpload className="size-4" /> Upload
              </TabsTrigger>
              <TabsTrigger value="write">
                <PencilLine className="size-4" /> Write
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {contractType === "write" ? (
            <FormControl>
              <RichTextEditor {...field} value={typeof field.value === "string" ? field.value : ""} />
            </FormControl>
          ) : value instanceof File ? (
            <div className="border-input flex items-center gap-2 rounded-md border py-2 pl-2">
              <div className="flex h-full w-10 items-center justify-center rounded-sm bg-red-50 p-2 text-sm text-red-600">
                PDF
              </div>
              <div>
                <p>{value.name}</p>
                <p className="text-muted-foreground text-sm">{formatFileSize(value.size)}</p>
              </div>
              <Button
                variant="link"
                size="icon"
                className="ml-auto hover:text-red-600"
                onClick={() => field.onChange("")}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : (
            <label
              className="relative"
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
            >
              <Placeholder icon={CloudUpload} className={isDragging ? "border-dashed border-blue-500 bg-blue-50" : ""}>
                <b>
                  Drag and drop or <span className={linkClasses}>click to browse</span> your PDF file here
                </b>
              </Placeholder>
              <FormControl>
                <input
                  type="file"
                  accept=".pdf"
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                  onChange={(e) => field.onChange(e.target.files?.[0])}
                />
              </FormControl>
            </label>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
