import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, PencilLine } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z
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

type FormValues = z.infer<typeof formSchema>;

type CreateLetterOfTransmittalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: (data: FormValues) => void;
  onBack: () => void;
};

const CreateLetterOfTransmittalModal = ({ isOpen, onClose, onNext, onBack }: CreateLetterOfTransmittalModalProps) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-lg flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>Letter of transmittal</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          <p className="mb-4 text-sm">
            Add the Letter of Transmittal to explain the buyback terms. Investors will see it during confirmation.
          </p>

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

          <div className="flex flex-1 flex-col overflow-auto">
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
                            <Textarea
                              {...field}
                              placeholder="Place or type your letter of transmittal here..."
                              className="min-h-100 resize-none"
                            />
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
    </Dialog>
  );
};

export default CreateLetterOfTransmittalModal;
