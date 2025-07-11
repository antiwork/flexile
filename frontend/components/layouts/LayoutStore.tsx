"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

interface LayoutState {
  title: ReactNode;
  headerActions: ReactNode;
  setTitle: (title: ReactNode) => void;
  setHeaderActions: (actions: ReactNode) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  title: null,
  headerActions: null,
  setTitle: (title) => set(() => ({ title })),
  setHeaderActions: (headerActions) => set(() => ({ headerActions })),
}));
