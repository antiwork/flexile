import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDate } from "@internationalized/date";
import { CloudUpload, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import DatePicker from "@/components/DatePicker";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z
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

type BuybackFormValues = z.infer<typeof formSchema>;

type NewBuybackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: (data: BuybackFormValues) => void;
};

const NewBuybackModal = ({ isOpen, onClose, onNext }: NewBuybackModalProps) => {
  const [dragActive, setDragActive] = useState(false);

  const form = useForm<BuybackFormValues>({
    resolver: zodResolver(formSchema),
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a new buyback</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm">
          Set the timeline, valuation, and upload your buyback terms to begin collecting investor bids.
        </p>

        <Form {...form}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-3">
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

        <DialogFooter className="mt-4">
          <Button onClick={() => void handleSubmit()} className="w-full sm:w-auto">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewBuybackModal;
