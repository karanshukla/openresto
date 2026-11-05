import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEmbedOrigins, saveEmbedOrigins } from "@/api/embedSettings";

/**
 * The allowed sites behind the Website widget page. Lifted out of the origins card because the
 * snippet card probes the proxy against the same list, and has to re-probe when it changes.
 * `origins` is null until the first load lands.
 *
 * @see [EmbedOriginsCard.test.tsx](../tests/components/admin/settings/EmbedOriginsCard.test.tsx):
 * pins that a save shows the server's canonical list, and that a refused one keeps the old list.
 */
export function useEmbedOrigins() {
  const { t } = useTranslation();
  const [origins, setOrigins] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmbedOrigins().then((list) => {
      if (list) setOrigins(list);
      else setError(t("admin.settings.embed.origins.loadFailed"));
    });
  }, [t]);

  const save = async (next: string[]) => {
    const result = await saveEmbedOrigins(next);
    if (result.ok) {
      setOrigins(result.origins);
      setError(null);
    } else {
      setError(result.message);
    }
  };

  return { origins, error, save };
}
