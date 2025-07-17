// Redirect to the main playground page
// The playground doesn't need a separate "new" route since it doesn't save to the database

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewPlaygroundPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/equity/waterfall/playground");
  }, [router]);
  
  return null;
}