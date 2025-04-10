"use client";

import { useUser } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useMutation } from "@tanstack/react-query";
import { Map } from "immutable";
import React, { useEffect, useState } from "react";
import { CardRow } from "@/components/Card";
import FormSection from "@/components/FormSection";
import Input from "@/components/Input";
import MutationButton from "@/components/MutationButton";
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
  const [email, setEmail] = useState(user.email);
  const [preferredName, setPreferredName] = useState(user.preferredName || "");
  const saveMutation = trpc.users.update.useMutation();
  const handleSubmit = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync({
        email,
        preferredName,
      });
    },
    onSuccess: () => setTimeout(() => handleSubmit.reset(), 2000),
  });

  return (
    <FormSection title="Personal details" onSubmit={e(() => handleSubmit.mutate(), "prevent")}>
      <CardRow className="grid gap-4">
        <Input value={email} onChange={setEmail} label="Email" minLength={MIN_EMAIL_LENGTH} />
        <Input
          value={preferredName}
          onChange={setPreferredName}
          label="Preferred name (visible to others)"
          placeholder="Enter preferred name"
          maxLength={MAX_PREFERRED_NAME_LENGTH}
        />
      </CardRow>
      <CardRow>
        <MutationButton type="submit" mutation={handleSubmit} loadingText="Saving..." successText="Saved!">
          Save
        </MutationButton>
      </CardRow>
    </FormSection>
  );
};

const PasswordSection = () => {
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState(Map<string, string>());
  const data = { currentPassword, password, confirmPassword };
  Object.entries(data).forEach(([key, value]) => useEffect(() => setErrors(errors.delete(key)), [value]));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const newErrors = errors.clear().withMutations((errors) => {
        Object.entries(data).forEach(([key, value]) => {
          if (!value) errors.set(key, "This field is required.");
        });
        if (data.password !== data.confirmPassword) errors.set("confirm_password", "Passwords do not match.");
      });

      setErrors(newErrors);
      if (newErrors.size > 0) return;
      try {
        await assertDefined(user).updatePassword({ currentPassword, newPassword: password });
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
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
      <CardRow className="grid gap-4">
        <Input
          value={currentPassword}
          label="Old password"
          type="password"
          invalid={errors.has("current_password")}
          help={errors.get("current_password")}
          onChange={setCurrentPassword}
        />
        <Input
          value={password}
          label="New password"
          type="password"
          invalid={errors.has("password")}
          help={errors.get("password")}
          onChange={setPassword}
        />
        <Input
          value={confirmPassword}
          label="Confirm new password"
          type="password"
          invalid={errors.has("confirm_password")}
          help={errors.get("confirm_password")}
          onChange={setConfirmPassword}
        />
      </CardRow>
      <CardRow>
        <MutationButton type="submit" mutation={saveMutation} loadingText="Saving...">
          Save
        </MutationButton>
      </CardRow>
    </FormSection>
  );
};
