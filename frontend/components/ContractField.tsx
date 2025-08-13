import { CloudUpload, PencilLine, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Label } from "react-aria-components";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import { Editor as RichTextEditor } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentCompany, useCurrentUser } from "@/global";
import { type Document } from "@/models/document";
import { trpc } from "@/trpc/client";

export const schema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  attachment: z.instanceof(File).optional(),
  signed: z.boolean().default(false),
});

const UploadFormFields = () => {
  const form = useFormContext<z.infer<typeof schema>>();
  const [dragActive, setDragActive] = useState(false);

  const file = form.watch("attachment");

  return (
    <>
      <FormField
        control={form.control}
        name="attachment"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              {file ? (
                <div className="bg-background border-muted mt-2 flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-red-50">
                      <span className="text-destructive text-xs font-medium">
                        {file.type.replace(/^.*\//u, "").toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium">{file.name}</div>
                      <div className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    onClick={() => {
                      form.setValue("attachment", undefined);
                      form.setValue("title", "");
                    }}
                  >
                    <Trash2 className="text-muted-foreground hover:text-destructive size-4" />
                    <span className="sr-only">Remove</span>
                  </Button>
                </div>
              ) : (
                <div
                  className={`mt-2 flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 transition-colors ${dragActive ? "border-primary bg-muted" : "border-muted bg-background"} `}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const droppedFile = e.dataTransfer.files[0] ?? null;
                    field.onChange(droppedFile);
                    if (droppedFile) {
                      form.setValue("title", droppedFile.name);
                      form.setValue("attachment", droppedFile);
                    }
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <CloudUpload className="h-8 w-8 text-gray-500" />
                    <span className="font-small">
                      Drag and drop or{" "}
                      <Label htmlFor="contract-upload" className="cursor-pointer text-blue-600">
                        click to browse
                      </Label>{" "}
                      your file here
                    </span>
                    <span className="text-sm text-gray-500">PDF, DOC, DOCx</span>
                    <Input
                      id="contract-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => field.onChange(e.target.files?.[0])}
                    />
                  </div>
                </div>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="signed"
        render={({ field }) => (
          <FormItem>
            <div className="mt-4 flex items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  name={field.name}
                  ref={field.ref}
                  disabled={field.disabled}
                />
              </FormControl>
              <FormLabel className="mb-0">Mark this document as signed</FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

const CreateFormFields = () => {
  const company = useCurrentCompany();
  const user = useCurrentUser();
  const [documentPopoverOpen, setDocumentPopoverOpen] = useState(false);
  const form = useFormContext<z.infer<typeof schema>>();
  const isCompanyRepresentative = !!user.roles.administrator || !!user.roles.lawyer;
  const userId = isCompanyRepresentative ? null : user.id;

  const { data: documents = [] } = trpc.documents.list.useQuery({
    companyId: company.id,
    userId,
    signable: true,
  });

  const filteredDocuments: Document[] = documents.filter((document: Document) => document.textContent);

  return (
    <>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Document</FormLabel>
            <Command shouldFilter={false}>
              <Popover open={!!documentPopoverOpen && filteredDocuments.length > 0}>
                <PopoverAnchor asChild>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      name="document-title"
                      autoComplete="off"
                      onFocus={() => setDocumentPopoverOpen(true)}
                      onBlur={() => setDocumentPopoverOpen(false)}
                      onChange={(e) => {
                        field.onChange(e);
                        setDocumentPopoverOpen(true);
                      }}
                    />
                  </FormControl>
                </PopoverAnchor>
                <PopoverContent
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  className="p-0"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <CommandList>
                    <CommandGroup>
                      {filteredDocuments.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={option.id.toString()}
                          onSelect={() => {
                            field.onChange(option.name);
                            setDocumentPopoverOpen(false);
                            const selectedDoc = filteredDocuments.find((doc) => doc.id === option.id);
                            if (selectedDoc) {
                              form.setValue("content", selectedDoc.textContent ?? "");
                            }
                          }}
                        >
                          {option.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </PopoverContent>
              </Popover>
            </Command>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="content"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Document content</FormLabel>
            <FormControl>
              <RichTextEditor {...field} value={field.value ?? ""} className="max-h-52 overflow-y-auto" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

const ContractField = ({ label }: { label?: string }) => {
  const form = useFormContext();

  const [selectedTab, setSelectedTab] = useState("upload");
  useEffect(() => {
    form.resetField("signed");
    form.resetField("attachment");
    form.resetField("title");
    form.resetField("content");
  }, [selectedTab]);

  return (
    <div className="space-y-2">
      <div>{label ? <Label>{label}</Label> : null}</div>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full">
          <TabsTrigger value="upload">
            <CloudUpload className="size-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="create">
            <PencilLine className="size-4" /> Write
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {(() => {
        switch (selectedTab) {
          case "upload":
            return <UploadFormFields />;
          case "create":
            return <CreateFormFields />;
        }
      })()}
    </div>
  );
};

export default ContractField;
