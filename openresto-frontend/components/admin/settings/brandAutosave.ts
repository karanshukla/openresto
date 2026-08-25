import i18n from "@/i18n";
import { saveBrandSettings, type BrandSettingsDto } from "@/api/admin";

/**
 * The brand PATCH in the shape {@link import("@/hooks/use-autosave").useAutosave} wants: null
 * when it saved, the message to show when it didn't. Every brand card autosaves the same way,
 * so the adapter lives here rather than being restated in each one.
 */
export async function saveBrandFields(fields: BrandSettingsDto): Promise<string | null> {
  const result = await saveBrandSettings(fields);
  if (!result) return i18n.t("admin.settings.brandAutosave.serverUnreachable");
  return result.ok ? null : result.message;
}
