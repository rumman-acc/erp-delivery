"use server";

import { getSettingsData, getAllUsers } from "@/lib/data/settings";

// Thin Server Action wrapper so the Settings modal (a Client Component)
// can fetch team/org-unit data on demand — instead of the old approach of
// fetching it in (app)/layout.tsx on every single navigation, whether or
// not anyone opens Settings.
export async function loadSettingsData(projectId: string) {
  return getSettingsData(projectId);
}

// Separate from loadSettingsData: only Super Admins ever open the Users
// tab, so this shouldn't run on every Settings modal open.
export async function loadUsersData() {
  return getAllUsers();
}
