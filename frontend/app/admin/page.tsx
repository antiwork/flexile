"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { request } from "@/utils/request";
import { admin_impersonation_index_path } from "@/utils/routes";

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

  const impersonationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await request({
        method: "POST",
        url: admin_impersonation_index_path(),
        accept: "json",
        jsonData: { email },
        assertOk: true,
      });
      const data = z.object({ redirect_url: z.string().url() }).parse(await response.json());
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      router.push(data.redirect_url as Route);
    },
    onError: (error) => {
      form.setError("email", { message: error.message });
    },
  });

  const handleSubmit = (values: ImpersonateForm) => {
    impersonationMutation.mutate(values.email);
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

          <Button
            type="submit"
            size="small"
            className="w-fit"
            disabled={!form.formState.isValid || impersonationMutation.isPending}
          >
            Impersonate user
          </Button>
        </form>
      </Form>
    </div>
  );
}
