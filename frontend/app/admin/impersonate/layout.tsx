import { type PropsWithChildren } from "react";
import PublicLayout from "@/app/(public)/layout";

export default function Layout({ children }: PropsWithChildren) {
  return <PublicLayout>{children}</PublicLayout>;
}
