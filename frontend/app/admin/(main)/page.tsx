"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const impersonateSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ImpersonateForm = z.infer<typeof impersonateSchema>;

export default function AdminPage() {
  const form = useForm<ImpersonateForm>({
    resolver: zodResolver(impersonateSchema),
    defaultValues: { email: "" },
  });
  const router = useRouter();

  const handleSubmit = (values: ImpersonateForm) => {
    router.push(`/admin/impersonate?${new URLSearchParams({ user_identifier: values.email })}`);
  };

  return (
    <div className="grid gap-8">
      <hgroup>
        <h2 className="mb-1 text-3xl font-bold">Admin</h2>
        <p className="text-muted-foreground">Impersonate users to troubleshoot issues.</p>
      </hgroup>

      <Form {...form}>
        <form className="grid max-w-md gap-4" onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input type="email" placeholder="Enter user email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="small" className="w-fit">
            Impersonate user
          </Button>
        </form>
      </Form>
    </div>
  );
}
