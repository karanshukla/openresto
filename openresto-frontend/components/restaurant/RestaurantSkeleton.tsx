import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import PageContainer from "@/components/layout/PageContainer";
import Skeleton from "@/components/common/Skeleton";
import { ThemedView } from "@/components/themed-view";

export default function RestaurantSkeleton() {
  return (
    <ThemedView style={styles.root}>
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          {/* Hero/Image Skeleton */}
          <Skeleton height={300} width="100%" borderRadius={12} />

          <View style={styles.content}>
            {/* Title */}
            <Skeleton height={32} width="60%" style={{ marginBottom: 12 }} />

            {/* Metadata Rows */}
            <View style={styles.row}>
              <Skeleton height={16} width={16} borderRadius={8} />
              <Skeleton height={16} width="40%" style={{ marginLeft: 8 }} />
            </View>
            <View style={styles.row}>
              <Skeleton height={16} width={16} borderRadius={8} />
              <Skeleton height={16} width="70%" style={{ marginLeft: 8 }} />
            </View>

            {/* Description */}
            <View style={{ marginTop: 20 }}>
              <Skeleton height={14} width="100%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="100%" style={{ marginBottom: 8 }} />
              <Skeleton height={14} width="80%" />
            </View>

            {/* Sections Title */}
            <Skeleton height={24} width="30%" style={{ marginTop: 32, marginBottom: 16 }} />

            {/* Section Card */}
            <View style={styles.sectionCard}>
              <Skeleton height={80} width="100%" borderRadius={12} />
            </View>
          </View>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  page: {
    maxWidth: 720,
    gap: 16,
  },
  content: {
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionCard: {
    marginTop: 8,
  },
});
