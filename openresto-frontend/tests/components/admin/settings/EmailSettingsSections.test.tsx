import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SmtpTestPanel } from "@/components/admin/settings/SmtpTestPanel";
import { BookingConfirmationToggle } from "@/components/admin/settings/BookingConfirmationToggle";
import { EmailFailuresList } from "@/components/admin/settings/EmailFailuresList";
import type { EmailFailureDto } from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const theme = {
  borderColor: "#ddd",
  mutedColor: "#888",
  primaryColor: "#0a7ea4",
  cardBg: "#fff",
  surface2: "#f9fafb",
  okColor: "#16a34a",
  okSoft: "#dcfce7",
  okBorder: "#16a34a50",
  dangerColor: "#dc2626",
  dangerSoft: "#fef2f2",
  dangerBorder: "#dc262650",
  accentSoft: "#0a7ea418",
};

describe("SmtpTestPanel", () => {
  const baseProps = {
    testState: "idle" as const,
    host: "smtp.gmail.com",
    port: "587",
    testMsg: "",
    username: "user@example.com",
    onTest: jest.fn(),
    ...theme,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders idle status by default", () => {
    render(<SmtpTestPanel {...baseProps} />);
    expect(screen.getByText("Not yet tested")).toBeTruthy();
    expect(screen.getByText("Send a test to verify settings before going live.")).toBeTruthy();
  });

  it("renders testing status with host:port subtitle", () => {
    render(<SmtpTestPanel {...baseProps} testState="testing" />);
    expect(screen.getByText("Testing connection…")).toBeTruthy();
    expect(screen.getByText("Reaching smtp.gmail.com:587…")).toBeTruthy();
    expect(screen.getByText("Testing…")).toBeTruthy();
  });

  it("renders success status with custom message", () => {
    render(<SmtpTestPanel {...baseProps} testState="ok" testMsg="All good." />);
    expect(screen.getByText("Connection successful")).toBeTruthy();
    expect(screen.getByText("All good.")).toBeTruthy();
    expect(screen.getByText("Re-test")).toBeTruthy();
  });

  it("renders failure status with fallback message when testMsg empty", () => {
    render(<SmtpTestPanel {...baseProps} testState="fail" />);
    expect(screen.getByText("Connection failed")).toBeTruthy();
    expect(screen.getByText("Check your credentials and try again.")).toBeTruthy();
  });

  it("does not call onTest when host or username is missing", () => {
    render(<SmtpTestPanel {...baseProps} host="" />);
    fireEvent.press(screen.getByText("Send test"));
    expect(baseProps.onTest).not.toHaveBeenCalled();
  });
});

describe("BookingConfirmationToggle", () => {
  const baseProps = {
    sendConfirmations: false,
    confirmDisabled: false,
    onToggle: jest.fn(),
    ...theme,
  };

  beforeEach(() => jest.clearAllMocks());

  it("renders the title and description", () => {
    render(<BookingConfirmationToggle {...baseProps} />);
    expect(screen.getByText("Booking confirmation")).toBeTruthy();
    expect(screen.getByText("Sent the moment a guest books a table.")).toBeTruthy();
  });

  it("does not render the disabled hint when enabled", () => {
    render(<BookingConfirmationToggle {...baseProps} confirmDisabled={false} />);
    expect(screen.queryByText("Configure and test SMTP above to enable.")).toBeNull();
  });

  it("renders the disabled hint when confirmDisabled is true", () => {
    render(<BookingConfirmationToggle {...baseProps} confirmDisabled={true} />);
    expect(screen.getByText("Configure and test SMTP above to enable.")).toBeTruthy();
  });
});

describe("EmailFailuresList", () => {
  const failures: EmailFailureDto[] = [
    {
      id: 1,
      recipientEmail: "guest@example.com",
      attemptedAt: "2026-07-07T10:30:00Z",
      errorMessage: "SMTP timeout",
      bookingRef: "ABC123",
    },
    {
      id: 2,
      recipientEmail: "other@example.com",
      attemptedAt: "2026-07-07T11:00:00Z",
      errorMessage: "Auth rejected",
      bookingRef: null,
    },
  ];

  it("renders nothing when there are no failures", () => {
    const { toJSON } = render(
      <EmailFailuresList
        failures={[]}
        mutedColor="#888"
        dangerBorder="#d50"
        dangerSoft="#fee"
        dangerColor="#d00"
      />
    );
    expect(toJSON()).toBeNull();
  });

  it("renders each failure recipient + error + ref", () => {
    render(
      <EmailFailuresList
        failures={failures}
        mutedColor="#888"
        dangerBorder="#d50"
        dangerSoft="#fee"
        dangerColor="#d00"
      />
    );
    expect(screen.getByText("guest@example.com")).toBeTruthy();
    expect(screen.getByText("other@example.com")).toBeTruthy();
    expect(screen.getByText("Ref: ABC123")).toBeTruthy();
    expect(screen.getByText("SMTP timeout")).toBeTruthy();
    expect(screen.getByText("Auth rejected")).toBeTruthy();
  });

  it("omits the ref line when bookingRef is null", () => {
    render(
      <EmailFailuresList
        failures={failures}
        mutedColor="#888"
        dangerBorder="#d50"
        dangerSoft="#fee"
        dangerColor="#d00"
      />
    );
    expect(screen.getAllByText(/Ref:/)).toHaveLength(1); // only the ABC123 row
  });
});
