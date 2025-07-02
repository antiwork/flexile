import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, Link2, PencilLine, PenLine, PenTool } from "lucide-react";

const formSchema = z.object({
  content: z.string().min(1, "Letter content is required"),
});

type FormValues = z.infer<typeof formSchema>;

type CreateLetterOfTransmittalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onNext: (data: any) => void;
  onBack: () => void;
  data?: any;
};

const CreateLetterOfTransmittalModal = ({
  isOpen,
  onClose,
  onNext,
  onBack,
  data,
}: CreateLetterOfTransmittalModalProps) => {
  const [activeTab, setActiveTab] = useState<"link" | "create">(data?.type || "link");
  const [linkValue, setLinkValue] = useState(data?.link || "");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...data,
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    onNext({
      type: "create",
      content: data.content,
    });
  });

  const handleContinue = () => {
    onNext({
      type: "link",
      link: linkValue,
    });
  };

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
              onClick={() => setActiveTab("link")}
              className={`flex flex-1 items-center justify-center space-x-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "link" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Link2 className="h-4 w-4" />
              <span>Link</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`flex flex-1 items-center justify-center space-x-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "create" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <PencilLine className="h-4 w-4" />
              <span>Create</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-auto">
            {activeTab === "link" ? (
              <div className="text-center">
                <input
                  type="url"
                  placeholder="Paste https://..."
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  className="w-full rounded-sm border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col">
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Place or type your letter of transmittal here..."
                            className="min-h-100 resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Rich text formatting will be preserved. You can paste from Word or Google Docs.
                  </p>
                </form>
              </Form>
            )}
          </div>
        </div>

        <DialogFooter className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="outline" onClick={onBack} className="w-full sm:w-24">
            Back
          </Button>
          <Button
            onClick={() => {
              if (activeTab === "create") {
                void handleSubmit();
              } else {
                handleContinue();
              }
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
