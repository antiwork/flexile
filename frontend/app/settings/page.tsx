"use client";

import { useMutation } from "@tanstack/react-query";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/global";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { request } from "@/utils/request";
import { settings_path } from "@/utils/routes";

export default function SettingsPage() {
  const user = useCurrentUser();
  const form = useForm({
    defaultValues: {
      email: user.email,
      preferredName: user.preferredName || "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: { email: string; preferredName: string }) => {
      const response = await request({
        url: settings_path(),
        method: "PATCH",
        accept: "json",
        jsonData: { settings: { email: values.email, preferred_name: values.preferredName } },
      });
      if (!response.ok)
        throw new Error(z.object({ error_message: z.string() }).parse(await response.json()).error_message);
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <h2 className="mb-4 text-xl font-medium">Profile</h2>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" minLength={MIN_EMAIL_LENGTH} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="preferredName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preferred name (visible to others)</FormLabel>
              <FormControl>
                <Input placeholder="Enter preferred name" maxLength={MAX_PREFERRED_NAME_LENGTH} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {saveMutation.isError ? <p className="text-red-500">{saveMutation.error.message}</p> : null}
        <MutationStatusButton
          className="w-fit"
          type="submit"
          mutation={saveMutation}
          loadingText="Saving..."
          successText="Saved!"
        >
          Save
        </MutationStatusButton>
      </form>
    </Form>
  );
}
