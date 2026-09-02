import { useCallback, useEffect, useState } from "react";
import { subscribeReminder, unsubscribeReminder } from "@/api/reminders";
import { useBrand } from "@/context/BrandContext";
import { useLocale } from "@/context/LocaleContext";
import { canRegisterForReminders, registerForReminders } from "@/services/pushRegistration";
import { forgetReminder, rememberReminder, reminderEndpointFor } from "@/utils/reminderRegistry";

export type ReminderStatus =
  /** This device cannot receive reminders; render nothing. */
  | "unsupported"
  | "off"
  | "busy"
  | "on"
  /** The OS prompt was refused; the toggle explains rather than re-prompting. */
  | "denied"
  | "error";

/**
 * One booking's reminder opt-in on this device. The device is the unit: the server keys a
 * subscription to a push address, so a second phone opting in is a second subscription and
 * opting out here leaves it alone. Nothing is prompted for until `enable` is called; the OS
 * permission dialog is the guest's answer to a button they pressed, never a side effect of
 * opening the card.
 *
 * @see [use-booking-reminder.test.tsx](../tests/hooks/use-booking-reminder.test.tsx) — pins
 * the unsupported/denied/error states, and that a remembered device reads as on.
 */
export function useBookingReminder(bookingRef: string, email: string) {
  const { webPushPublicKey } = useBrand();
  const { locale } = useLocale();
  const supported = canRegisterForReminders({ webPushPublicKey });
  const [status, setStatus] = useState<ReminderStatus>(() =>
    !supported ? "unsupported" : reminderEndpointFor(bookingRef) ? "on" : "off"
  );

  useEffect(() => {
    setStatus(!supported ? "unsupported" : reminderEndpointFor(bookingRef) ? "on" : "off");
  }, [bookingRef, supported]);

  const enable = useCallback(async () => {
    setStatus("busy");
    const result = await registerForReminders({ webPushPublicKey });
    if (result.status !== "registered") {
      setStatus(result.status === "denied" ? "denied" : "unsupported");
      return;
    }
    const ok = await subscribeReminder(bookingRef, email, result.registration, locale);
    if (!ok) {
      setStatus("error");
      return;
    }
    rememberReminder(bookingRef, result.registration.endpoint);
    setStatus("on");
  }, [bookingRef, email, locale, webPushPublicKey]);

  const disable = useCallback(async () => {
    const endpoint = reminderEndpointFor(bookingRef);
    setStatus("busy");
    // The device forgets first: a server that has already dropped the row (booking passed,
    // purged) answers 404, and that must not leave the toggle stuck on.
    forgetReminder(bookingRef);
    if (endpoint) await unsubscribeReminder(bookingRef, email, endpoint);
    setStatus("off");
  }, [bookingRef, email]);

  return { status, enable, disable };
}
