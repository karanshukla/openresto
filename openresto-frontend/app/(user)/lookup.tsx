import { useLocalSearchParams } from "expo-router";
import LookupScreen from "@/components/booking/LookupScreen";

/**
 * `/lookup?ref=&email=` is the confirmation email's link target as well as the plain
 * "find my booking" entry point, so a ref+email pair on the URL runs the lookup on mount
 * instead of waiting for the form to be filled in by hand. The native title itself is
 * static, so it's declared once on the "lookup" Stack.Screen in app/(user)/_layout.tsx
 * rather than repeated here.
 */
export default function LookupRouteScreen() {
  const { ref, email } = useLocalSearchParams<{ ref?: string; email?: string }>();

  return <LookupScreen initialRef={ref || undefined} initialEmail={email || undefined} />;
}
