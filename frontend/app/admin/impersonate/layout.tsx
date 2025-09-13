import { Suspense } from "react";
import PublicLayout from "@/app/(public)/layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <PublicLayout>{children}</PublicLayout>
    </Suspense>
  );
}
