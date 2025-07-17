import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import { ChevronDown, CloudUpload, Link2, PencilLine, Search, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createBuybackSchema } from "@/app/equity/buybacks";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentCompany } from "@/global";
import { fetchInvestorEmail, isInvestor } from "@/models/investor";
import { trpc } from "@/trpc/client";
import { cn, md5Checksum } from "@/utils";
import { request } from "@/utils/request";
import { richTextExtensions } from "@/utils/richText";
import { company_tender_offers_path } from "@/utils/routes";

const SimpleRichTextEditor = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const editor = useEditor({
    extensions: richTextExtensions,
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: cn(
          "prose max-w-none p-3 h-[50vh] overflow-y-auto",
          "border-input rounded-md border bg-transparent text-sm",
          "placeholder:text-muted-foreground",
          className,
        ),
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  return <EditorContent editor={editor} />;
};

const buybackFormSchema = z
  .object({
    type: z.enum(["single", "tender"]),
    name: z.string().min(1, "Buyback name is required"),
    start_date: z.instanceof(CalendarDate, { message: "Start date is required" }),
    end_date: z.instanceof(CalendarDate, { message: "End date is required" }),
    minimum_valuation: z.number().min(0, "Starting valuation must be positive"),
    starting_price: z.number().min(0, "Starting price must be positive"),
    total_amount: z.number().min(0, "Target buyback value must be positive"),
    attachment: z.instanceof(File, { message: "Buyback documents are required" }),
  })
  .refine((data) => data.start_date.compare(data.end_date) < 0, {
    message: "End date must be after start date",
    path: ["end_date"],
  });

const letterOfTransmittalFormSchema = z
  .object({
    type: z.enum(["link", "text"]),
    data: z.string(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "text" && !val.data.trim()) {
      ctx.addIssue({ path: ["data"], code: z.ZodIssueCode.custom, message: "Content is required" });
    }
    if (val.type === "link") {
      if (!val.data.trim()) {
        ctx.addIssue({ path: ["data"], code: z.ZodIssueCode.custom, message: "Link URL is required" });
      } else if (!/^https?:\/\/.+/iu.test(val.data)) {
        ctx.addIssue({ path: ["data"], code: z.ZodIssueCode.custom, message: "Please enter a valid URL" });
      }
    }
  });

type LetterOfTransmittalFormValues = z.infer<typeof letterOfTransmittalFormSchema>;

type BuybackFormValues = z.infer<typeof buybackFormSchema>;

type NewBuybackModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type BuybackFormSectionProps = {
  isActive: boolean;
  onNext: (data: BuybackFormValues) => void;
};

type CreateLetterOfTransmittalSectionProps = {
  isActive: boolean;
  onNext: (data: LetterOfTransmittalFormValues) => void;
  onBack: () => void;
};

type SelectInvestorsModalProps = {
  isActive: boolean;
  onBack: () => void;
  onNext: (data: string[]) => void;
  mutation: UseMutationResult<unknown, unknown, void>;
};

type ActiveSection = "buyback-details" | "letter-of-transmittal" | "select-investors";

const NewBuybackModal = ({ isOpen, onClose }: NewBuybackModalProps) => {
  const company = useCurrentCompany();

  const [buybackData, setBuybackData] = useState<Omit<
    z.infer<typeof createBuybackSchema>,
    "investors" | "letter_of_transmittal"
  > | null>(null);
  const [letterData, setLetterData] = useState<z.infer<typeof createBuybackSchema>["letter_of_transmittal"] | null>(
    null,
  );
  const [investorsData, setInvestorsData] = useState<z.infer<typeof createBuybackSchema>["investors"] | null>(null);

  const createUploadUrl = trpc.files.createDirectUploadUrl.useMutation();

  const handleInvestorsBack = () => {
    setActiveSection("letter-of-transmittal");
  };

  const [activeSection, setActiveSection] = useState<ActiveSection>("buyback-details");

  const createBuybackMutation = useMutation({
    mutationFn: async () => {
      if (!buybackData) {
        throw new Error("Buyback data is required");
      }

      const { attachment, ...jsonData } = buybackData;

      if (attachment) {
        const base64Checksum = await md5Checksum(attachment);
        const { directUploadUrl, key } = await createUploadUrl.mutateAsync({
          isPublic: false,
          filename: attachment.name,
          byteSize: attachment.size,
          checksum: base64Checksum,
          contentType: attachment.type,
        });

        await fetch(directUploadUrl, {
          method: "PUT",
          body: attachment,
          headers: {
            "Content-Type": attachment.type,
            "Content-MD5": base64Checksum,
          },
        });
        jsonData.attachment_key = key;
      }

      await request({
        method: "POST",
        url: company_tender_offers_path(company.id),
        accept: "json",
        jsonData: createBuybackSchema.parse({
          ...jsonData,
          letter_of_transmittal: letterData,
          investors: investorsData,
        }),
        assertOk: true,
      });
    },
    onSuccess: () => {
      setActiveSection("buyback-details");
      setBuybackData(null);
      setLetterData(null);
      setInvestorsData([]);
      onClose();
    },
    onError: (error) => {
      // TODO: Add proper error handling/toast notification
    },
  });
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <BuybackFormSection
        isActive={activeSection === "buyback-details"}
        onNext={({ start_date, end_date, total_amount, starting_price, ...data }) => {
          setBuybackData({
            ...data,
            starts_at: start_date.toString(),
            ends_at: end_date.toString(),
            total_amount_in_cents: total_amount * 100,
            starting_price_per_share_cents: starting_price * 100,
          });
          setActiveSection("letter-of-transmittal");
        }}
      />
      <CreateLetterOfTransmittalSection
        isActive={activeSection === "letter-of-transmittal"}
        onNext={(data) => {
          setLetterData(data);
          setActiveSection("select-investors");
        }}
        onBack={() => {
          setActiveSection("buyback-details");
        }}
      />
      <SelectInvestorsSection
        isActive={activeSection === "select-investors"}
        onBack={handleInvestorsBack}
        onNext={(data) => {
          setInvestorsData(data);
          setActiveSection("select-investors");
          createBuybackMutation.mutate();
        }}
        mutation={createBuybackMutation}
      />
    </Dialog>
  );
};

const BuybackFormSection = ({ isActive, onNext }: BuybackFormSectionProps) => {
  const [dragActive, setDragActive] = useState(false);

  const form = useForm<BuybackFormValues>({
    resolver: zodResolver(buybackFormSchema),
  });

  const handleSubmit = form.handleSubmit((values) => onNext(values));

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/zip" || file.name.endsWith(".zip")) {
        form.setValue("attachment", file);
        form.clearErrors("attachment");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      form.setValue("attachment", e.target.files[0]);
      form.clearErrors("attachment");
    }
  };

  const watchedFile = form.watch("attachment");

  if (!isActive) {
    return null;
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Start a new buyback</DialogTitle>
        <DialogDescription>
          Set the timeline, valuation, and upload your buyback terms to begin collecting investor bids.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={(e) => void handleSubmit(e)} className="max-h-[60vh] space-y-4 overflow-y-auto px-1 py-1">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type of buyback</FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => field.onChange("single")}
                    className={`rounded-sm border p-3 text-left text-sm transition-colors ${
                      field.value === "single"
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Single stock repurchase
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("tender")}
                    className={`rounded-sm border p-3 text-left text-sm transition-colors ${
                      field.value === "tender"
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Tender offer
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buyback name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DatePicker {...field} label="Start date" granularity="day" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <DatePicker {...field} label="End date" granularity="day" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="minimum_valuation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starting valuation</FormLabel>
                <FormControl>
                  <NumberInput {...field} prefix="$" placeholder="0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="starting_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starting price</FormLabel>
                <FormControl>
                  <NumberInput {...field} prefix="$" placeholder="0" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target buyback value</FormLabel>
                <FormControl>
                  <NumberInput {...field} prefix="$" placeholder="0" />
                </FormControl>
                <FormDescription className="text-xs">
                  Total amount of money you intend to spend on this buyback.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attachment"
            render={() => (
              <FormItem>
                <FormLabel>Buyback documents</FormLabel>
                <FormControl>
                  {watchedFile instanceof File ? (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600">
                            ZIP
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{watchedFile.name}</div>
                            <div className="text-xs text-gray-500">{(watchedFile.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            form.resetField("attachment");
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
                        dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <CloudUpload className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                      <div className="text-sm font-medium">
                        <span>Drag and drop</span> or{" "}
                        <label className="cursor-pointer text-blue-600 hover:text-blue-500">
                          <span>click to browse</span>
                          <input
                            type="file"
                            accept=".zip,application/zip"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>{" "}
                        your ZIP file here
                      </div>
                    </div>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <DialogFooter>
        <Button onClick={() => void handleSubmit()} className="w-full sm:w-auto">
          Continue
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const CreateLetterOfTransmittalSection = ({ isActive, onNext, onBack }: CreateLetterOfTransmittalSectionProps) => {
  const form = useForm<LetterOfTransmittalFormValues>({
    resolver: zodResolver(letterOfTransmittalFormSchema),
    defaultValues: { type: "link", data: "" },
  });

  const watchedType = form.watch("type");

  useEffect(() => {
    form.setValue("data", "");
    form.clearErrors("data");
  }, [watchedType, form]);

  const handleSubmit = form.handleSubmit((data) => {
    onNext(data);
  });

  if (!isActive) {
    return null;
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Letter of transmittal</DialogTitle>
        <DialogDescription>
          Add the Letter of Transmittal to explain the buyback terms. Investors will see it during confirmation.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex space-x-1 rounded-md bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => form.setValue("type", "link")}
            className={`flex flex-1 items-center justify-center space-x-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
              watchedType === "link" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Link2 className="h-4 w-4" />
            <span>Link</span>
          </button>
          <button
            type="button"
            onClick={() => form.setValue("type", "text")}
            className={`flex flex-1 items-center justify-center space-x-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
              watchedType === "text" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <PencilLine className="h-4 w-4" />
            <span>Create</span>
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-auto px-1 py-1">
          <Form {...form}>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col">
              <FormField
                control={form.control}
                name="data"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormControl>
                      {watchedType === "link" ? (
                        <Input
                          {...field}
                          type="url"
                          placeholder="Paste https://..."
                          className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm"
                        />
                      ) : (
                        <div>
                          <SimpleRichTextEditor value={field.value || ""} onChange={field.onChange} />
                          <p className="mt-2 text-xs text-gray-500">
                            Rich text formatting will be preserved. You can paste from Word or Google Docs.
                          </p>
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
      </div>

      <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <Button
          onClick={() => {
            void handleSubmit();
          }}
          className="w-full sm:w-24"
        >
          Continue
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const SelectInvestorsSection = ({ isActive, onBack, onNext, mutation }: SelectInvestorsModalProps) => {
  const company = useCurrentCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [shareClassFilter, setShareClassFilter] = useState("All share classes");
  const [selectedInvestors, setSelectedInvestors] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(true);

  const [capTable] = trpc.capTable.show.useSuspenseQuery({ companyId: company.id });

  const investors = capTable.investors.filter((inv) => isInvestor(inv));
  const allShareClasses = ["All share classes", ...capTable.shareClasses.map((sc) => sc.name)];

  const filteredInvestors = useMemo(
    () =>
      investors.filter((investor) => {
        const matchesSearch =
          investor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fetchInvestorEmail(investor)?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesShareClass =
          shareClassFilter === "All share classes" ||
          investor.shareClassHoldings.some((holding) => holding.shareClassName === shareClassFilter);

        return matchesSearch && matchesShareClass;
      }),
    [investors, searchTerm, shareClassFilter],
  );

  useEffect(() => {
    setAllSelected(selectedInvestors.size === filteredInvestors.length && filteredInvestors.length > 0);
  }, [selectedInvestors.size, filteredInvestors.length]);

  useEffect(() => {
    if (allSelected) {
      const allIds = new Set(filteredInvestors.map((inv) => inv.id));
      setSelectedInvestors(allIds);
    }
  }, [allSelected]);

  const handleInvestorToggle = (investorId: string) => {
    const newSelected = new Set(selectedInvestors);
    if (newSelected.has(investorId)) {
      newSelected.delete(investorId);
    } else {
      newSelected.add(investorId);
    }
    setSelectedInvestors(newSelected);
  };

  const handleNext = () => {
    onNext(Array.from(selectedInvestors));
  };

  if (!isActive) {
    return null;
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Select who can join this buyback</DialogTitle>
        <DialogDescription>
          Choose investors who should be allowed to place bids. Only selected investors will see and participate in this
          buyback.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 w-full justify-between sm:w-48">
              <span>{shareClassFilter}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {allShareClasses.map((shareClass) => (
              <DropdownMenuItem key={shareClass} onSelect={() => setShareClassFilter(shareClass)}>
                {shareClass}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col overflow-auto px-1 py-1">
        <div className="flex items-center space-x-3 py-3">
          <Checkbox
            id="all-investors"
            checked={allSelected || (selectedInvestors.size ? "indeterminate" : false)}
            onCheckedChange={() => {
              if (allSelected) {
                setSelectedInvestors(new Set());
              } else {
                const allIds = new Set(filteredInvestors.map((inv) => inv.id));
                setSelectedInvestors(allIds);
              }
            }}
            className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
          />
          <label htmlFor="all-investors" className="text-sm font-medium">
            {allSelected ? "All" : selectedInvestors.size} investors selected
          </label>
        </div>
        <div className="max-h-[50vh] overflow-auto">
          <div className="min-w-fit">
            {filteredInvestors.map((investor) => (
              <div
                key={investor.id}
                className={cn(
                  "flex w-full items-center justify-between border-t border-gray-200 py-3 pr-3",
                  selectedInvestors.has(investor.id) && "bg-blue-50",
                )}
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={investor.id}
                    checked={selectedInvestors.has(investor.id)}
                    onCheckedChange={() => handleInvestorToggle(investor.id)}
                    className="h-4 w-4 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                  />
                  <label htmlFor={investor.id} className="cursor-pointer text-sm">
                    {investor.name}
                  </label>
                </div>
                <div className="text-sm text-gray-500">
                  {investor.shareClassHoldings.map((holding) => holding.shareClassName).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <MutationStatusButton
          onClick={handleNext}
          mutation={mutation}
          className="w-full sm:w-auto"
          disabled={selectedInvestors.size === 0}
        >
          Create buyback
        </MutationStatusButton>
      </DialogFooter>
    </DialogContent>
  );
};

export default NewBuybackModal;
