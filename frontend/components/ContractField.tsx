import { useQuery } from "@tanstack/react-query";
import { CloudUpload, PencilIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Label } from "react-aria-components";
import { useFormContext } from "react-hook-form";
import { z } from "zod";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useUserStore } from "@/global";
import { type Document, documentSchema } from "@/models/document";
import { request } from "@/utils/request";
import { company_documents_path } from "@/utils/routes";
import { Editor as RichTextEditor } from "./RichText";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Input } from "./ui/input";

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
                <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-red-50">
                      <span className="text-xs font-medium text-red-500">
                        {file.type.replace(/^.*\//u, "").toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium">{file.name}</div>
                      <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="small"
                    aria-label="Remove file"
                    onClick={() => {
                      form.setValue("attachment", undefined);
                      form.setValue("title", "");
                    }}
                  >
                    <span className="sr-only">Remove</span>
                    <Trash2 className="text-grey-600 size-4 hover:text-red-600" />
                  </Button>
                </div>
              ) : (
                <div
                  className={`mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
                    dragActive ? "border-black bg-gray-50" : "border-gray-200 bg-white"
                  }`}
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
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0] ?? null;
                        field.onChange(selectedFile);
                        if (selectedFile) {
                          form.setValue("title", selectedFile.name);
                          form.setValue("attachment", selectedFile);
                        }
                      }}
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
  const companyId = useUserStore((state) => state.user?.currentCompanyId);
  const [documentPopoverOpen, setDocumentPopoverOpen] = useState(false);

  const form = useFormContext();
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      if (!companyId) return [];

      const url = company_documents_path(companyId);
      const response = await request({ method: "GET", accept: "json", url, assertOk: true });
      return z.array(documentSchema).parse(await response.json());
    },
    enabled: Boolean(companyId),
  });

  const filteredDocuments = documents.filter((document) => document.textContent);

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
                          value={option.id}
                          onSelect={() => {
                            field.onChange(option.name);
                            setDocumentPopoverOpen(false);
                            const selectedDoc = filteredDocuments.find((doc) => doc.id === option.id);
                            if (selectedDoc) {
                              form.setValue("content", selectedDoc.textContent);
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
              <RichTextEditor {...field} className="max-h-52 overflow-y-auto" />
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

  const tabs = [
    { label: "Upload", tab: "upload", icon: <CloudUpload className="h-4 w-4" /> },
    { label: "Write", tab: "create", icon: <PencilIcon className="h-4 w-4" /> },
  ];

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
      <div className="flex gap-2 rounded-lg bg-gray-50 p-2 shadow-sm">
        {tabs.map((tab) => (
          <Button
            key={tab.tab}
            variant="ghost"
            size="small"
            className={`w-full ${selectedTab === tab.tab ? "bg-white" : ""} hover:bg-slate-50`}
            onClick={() => setSelectedTab(tab.tab)}
            role="tab"
            aria-selected={selectedTab === tab.tab}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>
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
