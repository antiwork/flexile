import React from "react";
import { Card } from "@/components/ui/card";

const FormSection = ({
  title,
  description,
  children,
  ...props
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
} & React.FormHTMLAttributes<HTMLFormElement>) => (
  <form className="grid gap-x-5 gap-y-3 md:grid-cols-[25%_1fr]" {...props}>
    <hgroup>
      <h2 className="text-xl font-bold">{title}</h2>
      {description ? <p className="text-gray-400">{description}</p> : null}
    </hgroup>
    <Card>{children}</Card>
  </form>
);

export default FormSection;
