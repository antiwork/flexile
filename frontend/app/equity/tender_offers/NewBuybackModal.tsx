import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDate } from "@internationalized/date";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormControl, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberInput from "@/components/NumberInput";
import DatePicker from "@/components/DatePicker";
import { Upload } from "lucide-react";

const formSchema = z.object({
  buybackType: z.enum(["single", "tender"]),
  name: z.string().min(1, "Buyback name is required"),
  startDate: z.instanceof(CalendarDate, { message: "Start date is required" }),
  endDate: z.instanceof(CalendarDate, { message: "End date is required" }),
  startingValuation: z.number().min(0, "Starting valuation must be positive"),
  targetBuybackValue: z.number().min(0, "Target buyback value must be positive"),
  attachment: z.instanceof(File, { message: "Buyback documents are required" }),
});

type FormValues = z.infer<typeof formSchema>;

type NewBuybackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: (data: any) => void;
  data?: Partial<FormValues>;
};

const NewBuybackModal = ({ isOpen, onClose, onNext, data }: NewBuybackModalProps) => {
  const [dragActive, setDragActive] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...data,
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const buybackData = {
      ...data,
      startDate: data.startDate.toDate(localTimeZone),
      endDate: data.endDate.toDate(localTimeZone),
    };
    onNext(buybackData);
  });

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new buyback</DialogTitle>
        </DialogHeader>

        <p className="mb-4 text-sm text-gray-600">
          Set the timeline, valuation, and upload your buyback terms to begin collecting investor bids.
        </p>

        <Form {...form}>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="buybackType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of buyback</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange("single")}
                      className={`rounded-lg border p-3 text-left text-sm transition-colors ${
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
                      className={`rounded-lg border p-3 text-left text-sm transition-colors ${
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
                    <Input {...field} placeholder="" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
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
                name="endDate"
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
              name="startingValuation"
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
              name="targetBuybackValue"
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buyback documents</FormLabel>
                  <FormControl>
                    {watchedFile ? (
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
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Drag and drop</span> or{" "}
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
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} className="w-full sm:w-auto">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewBuybackModal;
