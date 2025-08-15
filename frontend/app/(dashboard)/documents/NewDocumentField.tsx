import { CloudUpload, PencilLine } from "lucide-react";
import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import { linkClasses } from "@/components/Link";
import Placeholder from "@/components/Placeholder";
import { Editor as RichTextEditor } from "@/components/RichText";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const schema = z.object({
  contractText: z.string().optional(),
  contractFile: z.instanceof(File).optional(),
});

export default function NewDocumentField() {
  const form = useFormContext<z.infer<typeof schema>>();
  const [contractType, setContractType] = useState("upload");

  return (
    <>
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
        <FormField control={form.control} name="contractText" render={({ field }) => <RichTextEditor {...field} />} />
      ) : (
        <label className="block cursor-pointer">
          <Placeholder icon={CloudUpload}>
            <b>
              Drag and drop or <span className={linkClasses}>click to browse</span> your file here
            </b>
            PDF
          </Placeholder>
          <FormField
            control={form.control}
            name="contractFile"
            render={({ field }) => (
              <Input type="file" accept=".pdf" hidden onChange={(e) => field.onChange(e.target.files?.[0])} />
            )}
          />
        </label>
      )}
    </>
  );
}
