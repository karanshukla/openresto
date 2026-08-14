import { Redirect } from "expo-router";

/** Settings is a group of routes now; Brand is its landing page. */
export default function AdminSettingsIndex() {
  return <Redirect href="/admin/settings/brand" />;
}
