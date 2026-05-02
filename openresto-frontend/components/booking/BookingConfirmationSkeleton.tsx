import React from "react";
import { View, StyleSheet, ScrollView, Platform, useWindowDimensions } from "react-native";
import PageContainer from "@/components/layout/PageContainer";
import Skeleton from "@/components/common/Skeleton";
import { ThemedView } from "@/components/themed-view";

export default function BookingConfirmationSkeleton() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;

  return (
    <ThemedView style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <PageContainer>
          {/* Header */}
          <View style={styles.successHeader}>
            <Skeleton height={56} width={56} borderRadius={28} />
            <Skeleton height={32} width="50%" style={{ marginTop: 10 }} />
            <Skeleton height={40} width="80%" style={{ marginTop: 10 }} />
          </View>

          {/* Reference Card */}
          <View style={styles.refCard}>
            <Skeleton height={12} width="30%" style={{ marginBottom: 12 }} />
            <Skeleton height={44} width="60%" borderRadius={10} />
            <Skeleton height={12} width="80%" style={{ marginTop: 12 }} />
          </View>

          {/* Detail Cards */}
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

          {/* Actions */}
          <View style={isWide ? styles.actionsWide : styles.actions}>
            <Skeleton height={48} width={isWide ? "48%" : "100%"} borderRadius={10} />
            <Skeleton height={48} width={isWide ? "48%" : "100%"} borderRadius={10} />
          </View>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60 },
  successHeader: { alignItems: "center", paddingTop: 48, paddingBottom: 16, gap: 10 },
  refCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  wideRow: { flexDirection: "row", gap: 20, marginTop: 4 },
  narrowGap: { gap: 16, marginTop: 4 },
  wideCol: { flex: 1 },
  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  actions: { gap: 10, marginTop: 24 },
  actionsWide: { flexDirection: "row", gap: 12, marginTop: 24, justifyContent: "center" },
});
