import { Stack } from "expo-router";
import { useBrand } from "@/context/BrandContext";
import GuestTabStack, { tabRoot } from "@/components/layout/GuestTabStack";

/**
 * The Home tab: the home screen, and the legacy `/search` URL that redirects to it. This group
 * sets no initial route on purpose — `index` already sorts first, and a root put under `/search`
 * would be doubled the moment the redirect replaced it.
 */
export default function HomeTabLayout() {
  const brand = useBrand();

  return (
    <GuestTabStack>
      <Stack.Screen name="index" options={{ ...tabRoot(), title: brand.appName }} />
      {/* /search only renders a <Redirect>, so a native header would flash a bar titled after
          the filename on the way through. */}
      <Stack.Screen name="search" options={{ headerShown: false }} />
    </GuestTabStack>
  );
}
