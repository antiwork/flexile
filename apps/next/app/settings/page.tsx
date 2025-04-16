"use client";

import { useUser } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useMutation } from "@tanstack/react-query";
import { Map } from "immutable";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import FormSection from "@/components/FormSection";
import MutationButton from "@/components/MutationButton";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CardContent, CardFooter } from "@/components/ui/card";
import { useCurrentUser } from "@/global";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";
import { trpc } from "@/trpc/client";
import { e } from "@/utils";
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

  const saveMutation = trpc.users.update.useMutation();
  const handleSubmit = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      await saveMutation.mutateAsync({
        email: values.email,
        preferredName: values.preferredName,
      });
    },
    onSuccess: () => setTimeout(() => handleSubmit.reset(), 2000),
  });

  return (
    <FormSection title="Personal details" onSubmit={e(() => handleSubmit.mutate(), "prevent")}>
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
        <MutationButton type="submit" mutation={handleSubmit} loadingText="Saving..." successText="Saved!">
          Save
        </MutationButton>
      </CardFooter>
    </FormSection>
  );
};

const PasswordSection = () => {
  const { user } = useUser();
  const form = useForm({
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });
  const [errors, setErrors] = useState(Map<string, string>());

  const saveMutation = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      const newErrors = errors.clear().withMutations((errors) => {
        Object.entries(values).forEach(([key, value]) => {
          if (!value) errors.set(key, "This field is required.");
        });
        if (values.password !== values.confirmPassword) errors.set("confirm_password", "Passwords do not match.");
      });

      setErrors(newErrors);
      if (newErrors.size > 0) return;
      try {
        await assertDefined(user).updatePassword({
          currentPassword: values.currentPassword,
          newPassword: values.password,
        });
        form.reset();
      } catch (error) {
        if (!isClerkAPIResponseError(error)) throw error;
        setErrors(errors.set("password", error.message));
      }
    },
    onSuccess: () => setTimeout(() => saveMutation.reset(), 2000),
  });
  if (!user) return null;

  return (
    <FormSection title="Password" onSubmit={e(() => saveMutation.mutate(), "prevent")}>
      <CardContent className="grid gap-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Old password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  invalid={errors.has("current_password")}
                  help={errors.get("current_password")}
                  {...field}
                />
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
                <Input type="password" invalid={errors.has("password")} help={errors.get("password")} {...field} />
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
                <Input
                  type="password"
                  invalid={errors.has("confirm_password")}
                  help={errors.get("confirm_password")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
      <CardFooter>
        <MutationButton type="submit" mutation={saveMutation} loadingText="Saving...">
          Save
        </MutationButton>
      </CardFooter>
    </FormSection>
  );
};
