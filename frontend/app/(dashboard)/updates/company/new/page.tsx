"use client";
import React, { useEffect } from "react";
import EditPage from "../Edit";
import { useLayoutStore } from "@/components/layouts/LayoutStore";

export default function New() {
  const setTitle = useLayoutStore((state) => state.setTitle);
  const setHeaderActions = useLayoutStore((state) => state.setHeaderActions);
  useEffect(() => {
    setTitle("New company update");
    setHeaderActions(null);
  }, [setTitle, setHeaderActions]);
  return <EditPage />;
}
