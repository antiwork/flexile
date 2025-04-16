"use client";

import { useUser } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import FormSection from "@/components/FormSection";
import { MutationStatusButton } from "@/components/MutationButton";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/global";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { trpc } from "@/trpc/client";
import { assertDefined } from "@/utils/assert";
import SettingsLayout from "./Layout";

export default function SettingsPage() {
  return (
    <SettingsLayout>
      <DetailsSection />
      <PasswordSection />
    </SettingsLayout>
  );
}

const DetailsSection = () => {
  const user = useCurrentUser();
  const form = useForm({
    defaultValues: {
      email: user.email,
      preferredName: user.preferredName || "",
    },
  });

  const saveMutation = trpc.users.update.useMutation({
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  const submit = form.handleSubmit((values) => saveMutation.mutate(values));

  return (
    <Form {...form}>
      <FormSection title="Personal details" onSubmit={(e) => void submit(e)}>
        <CardContent className="grid gap-4">
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
        </CardContent>
        <CardFooter>
          <MutationStatusButton type="submit" mutation={saveMutation} loadingText="Saving..." successText="Saved!">
            Save
          </MutationStatusButton>
        </CardFooter>
      </FormSection>
    </Form>
  );
};

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "This field is required"),
    password: z.string().min(1, "This field is required"),
    confirmPassword: z.string().min(1, "This field is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
const PasswordSection = () => {
  const { user } = useUser();
  const form = useForm({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: z.infer<typeof passwordFormSchema>) => {
      try {
        await assertDefined(user).updatePassword({
          currentPassword: values.currentPassword,
          newPassword: values.password,
        });
        form.reset();
      } catch (error) {
        if (!isClerkAPIResponseError(error)) throw error;
        form.setError("password", { message: error.message });
      }
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  const submit = form.handleSubmit((values) => saveMutation.mutate(values));
  if (!user) return null;

  return (
    <Form {...form}>
      <FormSection title="Password" onSubmit={(e) => void submit(e)}>
        <CardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Old password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter>
          <MutationStatusButton type="submit" mutation={saveMutation} loadingText="Saving...">
            Save
          </MutationStatusButton>
        </CardFooter>
      </FormSection>
    </Form>
  );
};
