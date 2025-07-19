import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate } from "@internationalized/date";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { EditorContent, useEditor } from "@tiptap/react";
import { ChevronDown, CloudUpload, Link2, PencilLine, Search, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createBuybackSchema } from "@/app/equity/buybacks";
import ComboBox from "@/components/ComboBox";
import DatePicker from "@/components/DatePicker";
import { MutationStatusButton } from "@/components/MutationButton";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogStackContent,
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
    buyback_type: z.enum(["single_stock", "tender_offer"]),
    name: z.string().min(1, "Buyback name is required"),
    investor_id: z.string().optional(),
    start_date: z.instanceof(CalendarDate, { message: "Start date is required" }),
    end_date: z.instanceof(CalendarDate, { message: "End date is required" }),
    minimum_valuation: z.number().min(0, "Starting valuation must be positive").optional(),
    starting_price: z.number().min(0, "Starting price must be positive"),
    total_amount: z.number().min(0, "Target buyback value must be positive"),
    attachment: z.instanceof(File, { message: "Buyback documents are required" }),
  })
  .superRefine((data, ctx) => {
    if (data.start_date.compare(data.end_date) >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["end_date"],
      });
    }
    if (data.buyback_type === "single_stock" && !data.investor_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Investor is required for single stock repurchase",
        path: ["investor_id"],
      });
    }
    if (data.buyback_type === "tender_offer" && (data.minimum_valuation === undefined || data.minimum_valuation <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starting valuation is required for tender offers",
        path: ["minimum_valuation"],
      });
    }
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

type BaseSectionProps<T = unknown> = {
  mutation?: UseMutationResult<unknown, unknown, void> | undefined;
  onNext?: (data: T) => void;
  onBack?: () => void;
};

type BuybackFormSectionProps = BaseSectionProps<BuybackFormValues> & {
  onNext: (data: BuybackFormValues) => void;
  onSelectType: (type: "single_stock" | "tender_offer") => void;
};

type CreateLetterOfTransmittalSectionProps = BaseSectionProps<LetterOfTransmittalFormValues> & {
  onNext: (data: LetterOfTransmittalFormValues) => void;
  onBack: () => void;
};

type SelectInvestorsModalProps = BaseSectionProps<string[]> & {
  onBack: () => void;
  onNext: (data: string[]) => void;
};

type SectionNextButtonProps = React.ComponentProps<typeof Button> & {
  mutation?: UseMutationResult<unknown, unknown, void> | undefined;
  children?: React.ReactNode;
};

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

  const [currentStep, setCurrentStep] = useState(0);
  const [type, setType] = useState<"single_stock" | "tender_offer">("tender_offer");

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
      setCurrentStep(0);
      setBuybackData(null);
      setLetterData(null);
      setInvestorsData([]);
      onClose();
    },
    onError: (error) => {
      // TODO: Add proper error handling/toast notification
    },
  });

  const handleBuybackFormNext = ({
    start_date,
    end_date,
    total_amount,
    starting_price,
    investor_id,
    minimum_valuation,
    ...data
  }: BuybackFormValues) => {
    const buybackData = {
      ...data,
      minimum_valuation: minimum_valuation ?? 0,
      starts_at: start_date.toString(),
      ends_at: end_date.toString(),
      total_amount_in_cents: total_amount * 100,
      starting_price_per_share_cents: starting_price * 100,
    };
    setBuybackData(buybackData);

    if (type === "single_stock") {
      setInvestorsData(investor_id ? [investor_id] : []);
    }
    goToNextStep();
  };

  const handleLetterOfTransmittalNext = (data: LetterOfTransmittalFormValues) => {
    setLetterData(data);
    goToNextStep();
  };

  const handleSelectInvestorsNext = (data: string[]) => {
    setInvestorsData(data);
    goToNextStep();
  };

  const goToNextStep = () => {
    if (!sections[currentStep + 1]) {
      createBuybackMutation.mutate();
      return;
    }
    setCurrentStep(Math.min(sections.length - 1, currentStep + 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const sections =
    type === "single_stock"
      ? [
          <BuybackFormSection key="buyback-form" onNext={handleBuybackFormNext} onSelectType={setType} />,
          <CreateLetterOfTransmittalSection
            key="letter-of-transmittal"
            onNext={handleLetterOfTransmittalNext}
            onBack={goToPreviousStep}
            mutation={createBuybackMutation}
          />,
        ]
      : [
          <BuybackFormSection key="buyback-form" onNext={handleBuybackFormNext} onSelectType={setType} />,
          <CreateLetterOfTransmittalSection
            key="letter-of-transmittal"
            onNext={handleLetterOfTransmittalNext}
            onBack={goToPreviousStep}
          />,
          <SelectInvestorsSection
            key="select-investors"
            onBack={goToPreviousStep}
            onNext={handleSelectInvestorsNext}
            mutation={createBuybackMutation}
          />,
        ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogStackContent step={currentStep}>{sections}</DialogStackContent>
    </Dialog>
  );
};

const BuybackFormSection = ({ onNext, onSelectType, mutation }: BuybackFormSectionProps) => {
  const [dragActive, setDragActive] = useState(false);
  const company = useCurrentCompany();

  const form = useForm<BuybackFormValues>({
    resolver: zodResolver(buybackFormSchema),
    defaultValues: {
      buyback_type: "tender_offer",
    },
  });

  const selectedType = form.watch("buyback_type");

  useEffect(() => {
    onSelectType(selectedType);
  }, [selectedType]);

  const { data: capTable } = trpc.capTable.show.useQuery(
    {
      companyId: company.id,
    },
    {
      enabled: selectedType === "single_stock",
    },
  );

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
      if (file.type === "application/zip" || file.name.toLowerCase().endsWith(".zip")) {
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

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>Start a new buyback</DialogTitle>
        <DialogDescription>
          Set the timeline, valuation, and upload your buyback terms to begin collecting investor bids.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={(e) => void handleSubmit(e)} className="max-h-[65vh] space-y-4 overflow-y-auto px-1 py-1">
          <FormField
            control={form.control}
            name="buyback_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type of buyback</FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => field.onChange("single_stock")}
                    className={`rounded-sm border p-3 text-left text-sm transition-colors ${
                      field.value === "single_stock"
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    Single stock repurchase
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("tender_offer")}
                    className={`rounded-sm border p-3 text-left text-sm transition-colors ${
                      field.value === "tender_offer"
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

          {selectedType === "single_stock" && (
            <FormField
              control={form.control}
              name="investor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investor</FormLabel>
                  <FormControl>
                    <ComboBox
                      {...field}
                      placeholder="Select investor"
                      options={(capTable?.investors || [])
                        .filter((inv) => isInvestor(inv))
                        .map((investor) => ({
                          value: investor.id,
                          label: investor.name,
                        }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
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

          {selectedType === "tender_offer" && (
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
          )}

          <FormField
            control={form.control}
            name="starting_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{selectedType === "single_stock" ? "Price per share" : "Starting price"}</FormLabel>
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
                  {selectedType === "single_stock"
                    ? (() => {
                        const price = form.watch("starting_price") || 0;
                        const total = form.watch("total_amount") || 0;
                        const shares = price > 0 ? Math.round(total / price) : 0;
                        return `This equals ${shares.toLocaleString()} shares at $${price.toFixed(2)} per share.`;
                      })()
                    : "Total amount of money you intend to spend on this buyback."}
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

      <DialogFooter className="mt-4">
        <SectionNextButton onClick={() => void handleSubmit()} className="w-full sm:w-auto" mutation={mutation} />
      </DialogFooter>
    </div>
  );
};

const CreateLetterOfTransmittalSection = ({ onNext, onBack, mutation }: CreateLetterOfTransmittalSectionProps) => {
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

  return (
    <div className="space-y-4">
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

      <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <SectionNextButton onClick={() => void handleSubmit()} className="w-full sm:w-auto" mutation={mutation} />
      </DialogFooter>
    </div>
  );
};

const SelectInvestorsSection = ({ onBack, onNext, mutation }: SelectInvestorsModalProps) => {
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

  return (
    <div className="space-y-4">
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

      <DialogFooter className="mt-4 flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
          Back
        </Button>
        <SectionNextButton
          onClick={handleNext}
          mutation={mutation}
          className="w-full sm:w-auto"
          disabled={selectedInvestors.size === 0}
        />
      </DialogFooter>
    </div>
  );
};

const SectionNextButton = ({ mutation, children, ...props }: SectionNextButtonProps) => {
  if (mutation) {
    return (
      <MutationStatusButton mutation={mutation} {...props}>
        {children || "Create buyback"}
      </MutationStatusButton>
    );
  }

  return <Button {...props}>{children || "Continue"}</Button>;
};

export default NewBuybackModal;
