"use client";
import React from "react";
import EditPage from "@/app/(dashboard)/updates/company/Edit";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function New() {
  return (
    <>
      <DashboardHeader title="New company update" />

      <EditPage />
    </>
  );
}
