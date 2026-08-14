import { useEffect, useState } from "react";
import {
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  getEmailFailures,
  type EmailFailureDto,
} from "@/api/admin";

export type EmailTestState = "idle" | "testing" | "ok" | "fail";

/**
 * The SMTP settings form's state, lifted out of the card so the delivery-status panel beside it
 * can share it. Both halves read the same values and the same test result: `handleTest` saves the
 * form before testing, so the panel is always reporting on what is in the fields, not on whatever
 * was last persisted.
 *
 * One payload, one save — `sendBookingConfirmations` travels with the SMTP credentials because the
 * API stores them as a single record, so the toggle stays in the card that owns that save.
 */
export function useEmailSettings() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enableSsl, setEnableSsl] = useState(true);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<EmailTestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [sendConfirmations, setSendConfirmations] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [failures, setFailures] = useState<EmailFailureDto[]>([]);

  useEffect(() => {
    getEmailSettings().then((s) => {
      setHost(s.host);
      setPort(String(s.port));
      setUsername(s.username);
      setPassword(s.password);
      setEnableSsl(s.enableSsl);
      setFromName(s.fromName ?? "");
      setFromEmail(s.fromEmail ?? "");
      setIsConfigured(s.isConfigured);
      setSendConfirmations(s.sendBookingConfirmations ?? false);
      if (s.isConfigured) setTestState("ok");
      const matched = EMAIL_PROVIDERS.find((p) => p.host && p.host === s.host);
      if (matched) setActiveProviderId(matched.id);
    });
    getEmailFailures().then(setFailures);
  }, []);

  const selectProvider = (p: EmailProvider) => {
    setActiveProviderId(p.id);
    if (p.host) setHost(p.host);
    setPort(String(p.port));
    setEnableSsl(true);
  };

  const buildPayload = () => ({
    host,
    port: parseInt(port, 10) || 587,
    username,
    password,
    enableSsl,
    fromName: fromName || undefined,
    fromEmail: fromEmail || undefined,
    sendBookingConfirmations: sendConfirmations,
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const result = await saveEmailSettings(buildPayload());
    setSaving(false);
    if (result) {
      setSaveMsg({ text: result.message, ok: true });
      setIsConfigured(true);
    } else {
      setSaveMsg({ text: "Failed to save.", ok: false });
    }
  };

  const handleTest = async () => {
    setTestState("testing");
    setTestMsg("");
    await saveEmailSettings(buildPayload());
    setIsConfigured(true);
    const result = await testEmailConnection();
    setTestState(result.ok ? "ok" : "fail");
    setTestMsg(result.message);
  };

  const toggleConfirmations = (next: boolean) => {
    setSendConfirmations(next);
    // The hint shares the slot the save outcome uses, so toggling back off has to clear it:
    // otherwise "Save to apply" sits there after the change it referred to has been undone.
    setSaveMsg(
      next
        ? { text: "Emails will be sent using your SMTP account. Save to apply.", ok: false }
        : null
    );
  };

  return {
    host,
    setHost,
    port,
    setPort,
    username,
    setUsername,
    password,
    setPassword,
    enableSsl,
    setEnableSsl,
    fromName,
    setFromName,
    fromEmail,
    setFromEmail,
    saving,
    testState,
    testMsg,
    saveMsg,
    isConfigured,
    sendConfirmations,
    activeProviderId,
    failures,
    selectProvider,
    handleSave,
    handleTest,
    toggleConfirmations,
    /** Confirmations can only be enabled once the connection has actually been proven. */
    confirmDisabled: !isConfigured && testState !== "ok",
  };
}

export type EmailSettingsState = ReturnType<typeof useEmailSettings>;

export interface EmailProvider {
  id: string;
  name: string;
  host: string;
  port: number;
  hint: string;
  icon: "mail-outline" | "mail-open-outline" | "cog-outline";
}

export const EMAIL_PROVIDERS: EmailProvider[] = [
  {
    id: "gmail",
    name: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    hint: "Use an app password",
    icon: "mail-outline",
  },
  {
    id: "outlook",
    name: "Outlook 365",
    host: "smtp.office365.com",
    port: 587,
    hint: "Modern auth",
    icon: "mail-open-outline",
  },
  {
    id: "custom",
    name: "Custom SMTP",
    host: "",
    port: 587,
    hint: "Your own host",
    icon: "cog-outline",
  },
];
