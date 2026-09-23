import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedView } from "@/components/themed-view";
import PageContainer from "@/components/layout/PageContainer";
import ScreenHeading from "@/components/layout/ScreenHeading";
import { useWaitlistEntry } from "./useWaitlistEntry";
import WaitlistTicket from "./WaitlistTicket";
import { styles } from "./WaitlistStatusScreen.styles";

/** The page the "table ready" email links to: the guest's ticket on its own. */
export default function WaitlistStatusScreen({ entryRef }: { entryRef: string }) {
  const { t } = useTranslation();
  const state = useWaitlistEntry(entryRef);

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PageContainer style={styles.page}>
          {state.entry !== undefined && (
            <ScreenHeading
              title={t("booking.waitlistStatus.routeTitle")}
              subtitle={state.entry?.restaurantName ?? ""}
            />
          )}
          <WaitlistTicket state={state} />
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}
