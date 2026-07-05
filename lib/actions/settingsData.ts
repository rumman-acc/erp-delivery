"use server";

import { getSettingsData } from "@/lib/data/settings";

// Thin Server Action wrapper so the Settings modal (a Client Component)
// can fetch team/org-unit data on demand — instead of the old approach of
// fetching it in (app)/layout.tsx on every single navigation, whether or
// not anyone opens Settings.
export async function loadSettingsData(projectId: string) {
  return getSettingsData(projectId);
}
