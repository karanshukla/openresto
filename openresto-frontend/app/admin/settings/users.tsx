import { Redirect } from "expo-router";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";
import { UsersCard } from "@/components/admin/settings/UsersCard";
import PageLoader from "@/components/common/PageLoader";
import { useAuth, useCan } from "@/context/AuthContext";

export default function UserSettingsScreen() {
  const palette = useSettingsPalette();
  const { status } = useAuth();
  // The API refuses these calls for a Manager, so the route is a dead end rather than a
  // disabled screen. The sidebar hides the entry too; this catches a typed-in URL.
  const canManageUsers = useCan("manage:users");

  // An unresolved session has no role yet, so waiting is the difference between an Owner
  // landing here and an Owner being bounced to Account on a cold load.
  if (status === "loading") return <PageLoader />;
  if (!canManageUsers) return <Redirect href="/admin/settings/account" />;

  return (
    <SettingsPage title="Users" subtitle="Who can sign in to this admin panel, and as what.">
      <UsersCard {...palette} />
    </SettingsPage>
  );
}
