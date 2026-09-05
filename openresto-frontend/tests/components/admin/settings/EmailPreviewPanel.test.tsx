import React from "react";
import { Platform, StyleSheet } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { EmailPreviewPanel } from "@/components/admin/settings/EmailPreviewPanel";
import { useEmailSettings } from "@/hooks/use-email-settings";
import * as adminApi from "@/api/admin";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  getEmailSettings: jest.fn(),
  saveEmailSettings: jest.fn(),
  testEmailConnection: jest.fn(),
  getEmailFailures: jest.fn(),
  getEmailPreview: jest.fn(),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Tasting Room" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
  isDark: false,
};

const defaultSettings = {
  host: "smtp.test.com",
  port: 587,
  username: "user@test.com",
  password: "••••••••",
  enableSsl: true,
  fromName: "Riverside Bookings",
  fromEmail: "hello@riverside.example",
  isConfigured: true,
  sendBookingConfirmations: true,
};

const preview = {
  restaurantId: 1,
  restaurantName: "Riverside",
  recipientEmail: "alex.morgan@example.com",
  subject: "Booking confirmed – Riverside",
  html: "<html><body>Booking Confirmed</body></html>",
};

function Panel({ isDark }: { isDark: boolean }) {
  const email = useEmailSettings();
  return <EmailPreviewPanel {...baseProps} isDark={isDark} email={email} />;
}

async function renderPanel(settings: Partial<typeof defaultSettings> = {}, isDark = false) {
  (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({ ...defaultSettings, ...settings });
  render(<Panel isDark={isDark} />);
  await waitFor(() => expect(screen.getByText("Confirmation preview")).toBeTruthy());
}

function envelopeBackground() {
  return StyleSheet.flatten(screen.getByTestId("email-preview-envelope").props.style)
    .backgroundColor;
}

describe("EmailPreviewPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([]);
    (adminApi.getEmailPreview as jest.Mock).mockResolvedValue(preview);
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Riverside" },
    ]);
  });

  it("renders the server's subject and sample recipient", async () => {
    await renderPanel();

    await waitFor(() => expect(screen.getByText("Booking confirmed – Riverside")).toBeTruthy());
    expect(screen.getByText("alex.morgan@example.com")).toBeTruthy();
  });

  /**
   * The point of putting the envelope beside the form: the sender fields are this screen's own,
   * and the preview has to answer for them before they are saved.
   */
  it("shows the sender fields as typed, without waiting for a save", async () => {
    await renderPanel();

    await waitFor(() =>
      expect(screen.getByText("Riverside Bookings <hello@riverside.example>")).toBeTruthy()
    );
  });

  it("falls back to the app name when no sender address is set", async () => {
    await renderPanel({ fromName: "", fromEmail: "" });

    await waitFor(() =>
      expect(screen.getByText("Tasting Room (no sender address set yet)")).toBeTruthy()
    );
  });

  /** The pair that keeps the preview honest about whether any of this reaches a guest. */
  it("says so when confirmations are switched off", async () => {
    await renderPanel({ sendBookingConfirmations: false });

    await waitFor(() =>
      expect(
        screen.getByText("Booking confirmations are off, so guests receive nothing.")
      ).toBeTruthy()
    );
  });

  it("says so when SMTP is not configured at all", async () => {
    await renderPanel({ isConfigured: false, sendBookingConfirmations: false });

    await waitFor(() =>
      expect(
        screen.getByText("Nothing is sent yet: add your SMTP details and test the connection.")
      ).toBeTruthy()
    );
  });

  it("offers no location picker for a single location", async () => {
    await renderPanel();

    await waitFor(() => expect(adminApi.getEmailPreview).toHaveBeenCalled());
    expect(screen.queryByLabelText(/Preview location/)).toBeNull();
  });

  it("offers a location picker once there is more than one", async () => {
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Riverside" },
      { id: 2, name: "Old Town" },
    ]);
    await renderPanel();

    await waitFor(() => expect(screen.getByLabelText(/Preview location/)).toBeTruthy());
  });

  it("reports a preview it could not render rather than showing an empty frame", async () => {
    (adminApi.getEmailPreview as jest.Mock).mockResolvedValue(null);
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Riverside" },
      { id: 2, name: "Old Town" },
    ]);
    await renderPanel();

    await waitFor(() =>
      expect(screen.getByText("The preview could not be rendered.")).toBeTruthy()
    );
  });

  it("collapses so a long form can have the column back", async () => {
    await renderPanel();
    await waitFor(() => expect(screen.getByText("alex.morgan@example.com")).toBeTruthy());

    fireEvent.press(screen.getByLabelText("Confirmation preview"));

    await waitFor(() => expect(screen.queryByText("alex.morgan@example.com")).toBeNull());
  });

  /** Each location has its own photo, hours and reference format, so each renders differently. */
  it("re-renders against the location the admin picks", async () => {
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Riverside" },
      { id: 2, name: "Old Town" },
    ]);
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText(/Preview location/)).toBeTruthy());

    fireEvent.press(screen.getByLabelText(/Preview location/));
    fireEvent.press(await screen.findByLabelText("Old Town"));

    await waitFor(() => expect(adminApi.getEmailPreview).toHaveBeenCalledWith(2));
  });

  /** The envelope is admin chrome, so it follows the admin's theme, not the email's own. */
  it("draws its envelope on the admin's own surface in either theme", async () => {
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId("email-preview-envelope")).toBeTruthy());
    const light = envelopeBackground();

    screen.unmount();
    await renderPanel({}, true);
    await waitFor(() => expect(screen.getByTestId("email-preview-envelope")).toBeTruthy());

    expect(envelopeBackground()).not.toBe(light);
  });

  /**
   * Switching location twice puts two requests in flight, and the slower one is not the answer:
   * without the guard, the first location's email lands on top of the one being asked for.
   */
  it("discards a response the admin has already moved on from", async () => {
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Riverside" },
      { id: 2, name: "Old Town" },
    ]);
    let resolveFirst: (value: typeof preview) => void = () => {};
    (adminApi.getEmailPreview as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve))
    );
    const oldTown = { ...preview, restaurantId: 2, subject: "Booking confirmed – Old Town" };
    (adminApi.getEmailPreview as jest.Mock).mockResolvedValue(oldTown);

    await renderPanel();
    fireEvent.press(screen.getByLabelText(/Preview location/));
    fireEvent.press(await screen.findByLabelText("Old Town"));
    await waitFor(() => expect(screen.getByText("Booking confirmed – Old Town")).toBeTruthy());

    resolveFirst(preview);

    await waitFor(() => expect(screen.getByText("Booking confirmed – Old Town")).toBeTruthy());
    expect(screen.queryByText("Booking confirmed – Riverside")).toBeNull();
  });

  /**
   * The body is the server's own HTML in a sandboxed iframe — web only, which is where the admin
   * runs. A React miniature of the email is the thing this exists not to be.
   */
  it("renders the email body in a sandboxed iframe on web", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    try {
      await renderPanel();

      await waitFor(() => expect(screen.getByTestId("email-preview-envelope")).toBeTruthy());
      const frame = screen.UNSAFE_getByProps({ "data-testid": "email-preview-frame" });
      expect(frame.props.srcDoc).toBe(preview.html);
      expect(frame.props.sandbox).toBe("");
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    }
  });
});
