import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useBrand } from "@/context/BrandContext";

/**
 * The homepage-visible slice of brand configuration, as the admin currently has it typed —
 * not as it is stored. `BrandPreview` renders from this, so an edit shows up before it is saved.
 */
export interface BrandDraft {
  appName: string;
  primaryColor: string;
  faviconIcon?: string;
  subtitle: string;
  websiteUrl: string;
  privacyPolicyUrl: string;
  headerImageUrl: string | null;
  headerImageFit: string;
  highlightsHeading: string;
  highlightsSubheading: string;
  copyrightText: string;
  highlights: { id: number; title: string; body: string; iconKey: string; link?: string | null }[];
  socialLinks: { id: number; label: string; iconKey: string }[];
}

function draftFromBrand(brand: ReturnType<typeof useBrand>): BrandDraft {
  return {
    appName: brand.appName,
    primaryColor: brand.primaryColor,
    faviconIcon: brand.faviconIcon,
    subtitle: brand.subtitle ?? "",
    websiteUrl: brand.websiteUrl ?? "",
    privacyPolicyUrl: brand.privacyPolicyUrl ?? "",
    headerImageUrl: brand.headerImageUrl ?? null,
    headerImageFit: brand.headerImageFit ?? "Cover",
    highlightsHeading: brand.highlightsHeading ?? "",
    highlightsSubheading: brand.highlightsSubheading ?? "",
    copyrightText: brand.copyrightText ?? "",
    highlights: [],
    socialLinks: [],
  };
}

interface BrandDraftValue {
  draft: BrandDraft;
  publish: (values: Partial<BrandDraft>) => void;
}

/**
 * Null rather than a stub default: the cards are mounted on their own in unit tests and on
 * routes that have no preview, and {@link useBrandDraftPublish} treats "no provider" as
 * "nothing is listening" rather than silently writing into a throwaway store.
 */
const BrandDraftContext = createContext<BrandDraftValue | null>(null);

export function BrandDraftProvider({ children }: { children: ReactNode }) {
  const brand = useBrand();
  const [edits, setEdits] = useState<Partial<BrandDraft>>({});

  const publish = useCallback((values: Partial<BrandDraft>) => {
    setEdits((prev) => {
      const changed = Object.keys(values).some(
        (key) =>
          JSON.stringify(prev[key as keyof BrandDraft]) !==
          JSON.stringify(values[key as keyof BrandDraft])
      );
      return changed ? { ...prev, ...values } : prev;
    });
  }, []);

  const value = useMemo(
    () => ({ draft: { ...draftFromBrand(brand), ...edits }, publish }),
    [brand, edits, publish]
  );

  return <BrandDraftContext.Provider value={value}>{children}</BrandDraftContext.Provider>;
}

/** Reads the current draft. Falls back to the saved brand when there is no provider. */
export function useBrandDraft(): BrandDraft {
  const brand = useBrand();
  const ctx = useContext(BrandDraftContext);
  const fallback = useMemo(() => draftFromBrand(brand), [brand]);
  return ctx?.draft ?? fallback;
}

/**
 * Publishes a card's unsaved values to the preview. The values object is compared by its
 * serialised form so callers can pass a fresh literal (and fresh arrays) every render without
 * needing a memo of their own.
 */
export function useBrandDraftPublish(values: Partial<BrandDraft>) {
  const publish = useContext(BrandDraftContext)?.publish;
  const serialized = JSON.stringify(values);

  useEffect(() => {
    publish?.(JSON.parse(serialized) as Partial<BrandDraft>);
  }, [publish, serialized]);
}
