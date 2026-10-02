"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type WorkspaceState = {
  connectionId: string | null;
  sidebarCollapsed: boolean;
  setConnectionId: (id: string) => void;
  toggleSidebar: () => void;
};

export const useWorkspace = create<WorkspaceState>()(persist((set) => ({
  connectionId: null,
  sidebarCollapsed: false,
  setConnectionId: (connectionId) => set({ connectionId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}), { name: "dms-workspace", skipHydration: true }));

export type Preferences = {
  editorFontSize: number;
  timeoutMs: number;
  pageSize: number;
  refreshSeconds: number;
  compactRows: boolean;
};

const defaults: Preferences = { editorFontSize: 13, timeoutMs: 30_000, pageSize: 50, refreshSeconds: 15, compactRows: true };

type PreferenceState = Preferences & {
  update: (values: Partial<Preferences>) => void;
  reset: () => void;
};

export const usePreferences = create<PreferenceState>()(persist((set) => ({
  ...defaults,
  update: (values) => set(values),
  reset: () => set(defaults),
}), { name: "dms-preferences", skipHydration: true }));

