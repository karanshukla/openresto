import React from "react";
import { View, ScrollView, Platform, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import PageContainer from "@/components/layout/PageContainer";
import Skeleton from "@/components/common/Skeleton";
import { ThemedView } from "@/components/themed-view";
import { MOBILE_BREAKPOINT } from "@/constants/breakpoints";
import { styles } from "./BookingConfirmationSkeleton.styles";

/**
 * @param inline Renders just the skeleton cards, without the page-level ThemedView/
 * ScrollView/PageContainer wrapper — for embedding inside a result column that's
 * already inside a scrolling page (lookup's found/loading column), as opposed to
 * standing in for a whole screen (booking-confirmation's initial load).
 */
export default function BookingConfirmationSkeleton({ inline = false }: { inline?: boolean }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // Inline mode sits in the lookup result column, which is a fraction of the viewport
  // however wide that viewport is, so it always uses the single-column skeleton rather
  // than reading its own layout off the window.
  const isWide = !inline && Platform.OS === "web" && width >= MOBILE_BREAKPOINT;

  const content = (
    <>
      {!inline && (
        <View style={styles.successHeader}>
          <Skeleton height={56} width={56} borderRadius={28} />
          <Skeleton height={32} width="50%" style={{ marginTop: 10 }} />
          <Skeleton height={40} width="80%" style={{ marginTop: 10 }} />
        </View>
      )}

      <View style={styles.refCard}>
        <Skeleton height={12} width="30%" style={{ marginBottom: 12 }} />
        <Skeleton height={44} width="60%" borderRadius={10} />
        <Skeleton height={12} width="80%" style={{ marginTop: 12 }} />
      </View>

      <View style={isWide ? styles.wideRow : styles.narrowGap}>
        <View style={[styles.detailCard, isWide && styles.wideCol]}>
          <View style={{ padding: 20, gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Skeleton height={14} width="30%" />
                <Skeleton height={14} width="40%" />
              </View>
            ))}
          </View>
        </View>
        {isWide && (
          <View style={styles.wideCol}>
            <View style={styles.detailCard}>
              <View style={{ padding: 20, gap: 12 }}>
                <Skeleton height={40} width="100%" borderRadius={10} />
                <Skeleton height={40} width="100%" borderRadius={10} />
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={isWide ? styles.actionsWide : styles.actions}>
        <Skeleton height={48} width={isWide ? "48%" : "100%"} borderRadius={10} />
        <Skeleton height={48} width={isWide ? "48%" : "100%"} borderRadius={10} />
      </View>
    </>
  );

  if (inline) {
    return (
      <View
        role="status"
        accessibilityLiveRegion="polite"
        aria-busy
        accessibilityLabel={t("booking.confirmation.loadingInlineLabel")}
      >
        {content}
      </View>
    );
  }

  return (
    <ThemedView
      style={styles.root}
      role="status"
      accessibilityLiveRegion="polite"
      aria-busy
      accessibilityLabel={t("booking.confirmation.loadingLabel")}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <PageContainer>{content}</PageContainer>
      </ScrollView>
    </ThemedView>
  );
}
