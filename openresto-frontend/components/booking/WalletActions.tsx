import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { VENDOR_BRANDS } from "@/constants/vendorBrands";
import { appleWalletPassUrl, fetchGoogleWalletSaveUrl } from "@/api/wallet";
import { deliverApplePass, openGoogleWalletSave } from "@/utils/wallet";
import { styles } from "./WalletActions.styles";

interface WalletActionsProps {
  bookingRef: string;
  email: string;
  /** The card's hairline, rendered above the section only when the section itself renders. */
  separator?: React.ReactNode;
}

/**
 * Add-to-wallet pills, offered only for the issuers the server is configured with. On a phone
 * there is one pill, the platform's own wallet: an Android user handed an Apple pass gets a
 * file nothing opens. On web both configured pills show, since a desktop browser is the wrong
 * place to guess which phone the pass is heading to.
 *
 * Apple wears the neutral tone its achromatic mark asks for; Google its brand blue, as on the
 * calendar and directions rows.
 *
 * @see [WalletActions.test.tsx](../../tests/components/booking/WalletActions.test.tsx) — pins
 * the per-platform pill, nothing rendered when neither issuer is configured, and the failed
 * Google link note.
 */
export default function WalletActions({ bookingRef, email, separator }: WalletActionsProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { wallet } = useBrand();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const showApple = Boolean(wallet?.apple) && Platform.OS !== "android";
  const showGoogle = Boolean(wallet?.google) && Platform.OS !== "ios";
  if (!showApple && !showGoogle) return null;

  const addToApple = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await deliverApplePass(appleWalletPassUrl(bookingRef, email), bookingRef);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const addToGoogle = async () => {
    setBusy(true);
    setFailed(false);
    const saveUrl = await fetchGoogleWalletSaveUrl(bookingRef, email);
    setBusy(false);
    if (!saveUrl) {
      setFailed(true);
      return;
    }
    openGoogleWalletSave(saveUrl);
  };

  return (
    <>
      {separator}
      <View style={styles.wrap} testID="wallet-actions">
        <ThemedText style={[styles.title, { color: colors.muted }]}>
          {t("booking.wallet.heading")}
        </ThemedText>
        <ButtonRow align="start">
          {showApple && (
            <Button
              testID="wallet-apple-btn"
              variant="secondary"
              tone="neutral"
              size="sm"
              icon="logo-apple"
              loading={busy}
              onPress={() => void addToApple()}
              accessibilityLabel={t("booking.wallet.appleA11y")}
            >
              {t("booking.wallet.appleButton")}
            </Button>
          )}
          {showGoogle && (
            <Button
              testID="wallet-google-btn"
              variant="secondary"
              size="sm"
              icon="logo-google"
              accentColor={VENDOR_BRANDS.google}
              loading={busy}
              onPress={() => void addToGoogle()}
              accessibilityLabel={t("booking.wallet.googleA11y")}
            >
              {t("booking.wallet.googleButton")}
            </Button>
          )}
        </ButtonRow>
        {failed && (
          <ThemedText style={[styles.note, { color: colors.muted }]}>
            {t("booking.wallet.failed")}
          </ThemedText>
        )}
      </View>
    </>
  );
}
