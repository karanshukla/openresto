import React from "react";
import { View, StyleSheet, ScrollView, Platform } from "react-native";
import PageContainer from "@/components/layout/PageContainer";
import Skeleton from "@/components/common/Skeleton";
import { ThemedView } from "@/components/themed-view";

export default function BookingSkeleton() {
  return (
    <ThemedView style={styles.root}>
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          {/* Title */}
          <Skeleton height={32} width="40%" style={{ marginBottom: 4 }} />
          {/* Subtitle */}
          <Skeleton height={20} width="60%" style={{ marginBottom: 24 }} />

          {/* Form Fields Skeletons */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Skeleton height={14} width="20%" style={{ marginBottom: 8 }} />
              <Skeleton height={48} width="100%" borderRadius={10} />
            </View>
            <View style={styles.field}>
              <Skeleton height={14} width="30%" style={{ marginBottom: 8 }} />
              <Skeleton height={48} width="100%" borderRadius={10} />
            </View>
            <View style={styles.field}>
              <Skeleton height={14} width="25%" style={{ marginBottom: 8 }} />
              <Skeleton height={48} width="100%" borderRadius={10} />
            </View>
            <View style={styles.field}>
              <Skeleton height={14} width="40%" style={{ marginBottom: 8 }} />
              <Skeleton height={100} width="100%" borderRadius={10} />
            </View>

            <Skeleton height={50} width="100%" borderRadius={10} style={{ marginTop: 12 }} />
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
    maxWidth: Platform.OS === "web" ? 860 : 560,
    gap: 4,
  },
  form: {
    gap: 16,
  },
  field: {
    marginBottom: 8,
  },
});
