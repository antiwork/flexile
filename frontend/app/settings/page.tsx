"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/global";
import { MAX_PREFERRED_NAME_LENGTH, MIN_EMAIL_LENGTH } from "@/models";

export default function SettingsPage() {
  const user = useCurrentUser();
  const form = useForm({
    defaultValues: {
      email: user.email,
      preferredName: user.preferredName || "",
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const updateUser = async (values: { email: string; preferredName: string }) => {
    setIsLoading(true);
    setStatus("idle");
    try {
      const response = await fetch("/internal/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        let errorMessage = "Failed to update user";
        try {
          const errorData: unknown = await response.json();
          if (typeof errorData === "object" && errorData !== null && "error_message" in errorData) {
            if (typeof errorData === "object" && "error_message" in errorData) {
              const errorValue = errorData.error_message;
              if (typeof errorValue === "string") {
                errorMessage = errorValue;
              }
            }
          }
        } catch {}
        throw new Error(errorMessage);
      }

      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (_error) {
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  const submit = form.handleSubmit((values) => updateUser(values));

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
        <Button
          className="w-fit"
          type="submit"
          disabled={isLoading || status === "success"}
          variant={status === "success" ? "success" : status === "error" ? "critical" : undefined}
        >
          {isLoading ? "Saving..." : status === "success" ? "Saved!" : "Save"}
        </Button>
      </form>
    </Form>
  );
}
