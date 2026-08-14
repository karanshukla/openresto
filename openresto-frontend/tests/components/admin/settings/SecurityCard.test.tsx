import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import * as authApi from "@/api/auth";
import { AuthProvider } from "@/context/AuthContext";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/auth", () => ({
  getMyPvqStatus: jest.fn(),
  setupPvq: jest.fn(),
  changePassword: jest.fn(),
  checkSession: jest.fn(),
  changeEmail: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
};

// The card reads its identity from the auth context now, so every render needs a provider;
// `checkSession` (mocked below) is what decides who is signed in.
const renderCard = () =>
  render(
    <AuthProvider>
      <SecurityCard {...baseProps} />
    </AuthProvider>
  );

describe("SecurityCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authApi.getMyPvqStatus as jest.Mock).mockResolvedValue(null);
    (authApi.checkSession as jest.Mock).mockResolvedValue({
      id: 1,
      email: "admin@test.com",
      displayName: null,
      role: "Owner",
    });
  });

  it("renders Account Security title", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("Account Security")).toBeTruthy();
    });
  });

  it("renders expanded by default (rows visible)", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Account Security")).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByText("Security Question")).toBeTruthy();
      expect(screen.getByText("Password")).toBeTruthy();
    });
  });

  it("collapses when header is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Security Question")).toBeTruthy());
    fireEvent.press(screen.getByText("Account Security"));
    await waitFor(() => {
      expect(screen.queryByText("Security Question")).toBeNull();
      expect(screen.queryByText("Password")).toBeNull();
    });
  });

  it("expands when header is pressed after collapse", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Security Question")).toBeTruthy());
    fireEvent.press(screen.getByText("Account Security"));
    await waitFor(() => expect(screen.queryByText("Security Question")).toBeNull());
    fireEvent.press(screen.getByText("Account Security"));
    await waitFor(() => {
      expect(screen.getByText("Security Question")).toBeTruthy();
    });
  });

  it("shows 'Not configured' when PVQ status is null", async () => {
    (authApi.getMyPvqStatus as jest.Mock).mockResolvedValue(null);
    renderCard();
    await waitFor(() => {
      expect(screen.getByText(/Not configured - set one up to enable password reset/)).toBeTruthy();
    });
  });

  it("shows configured PVQ question when status is configured", async () => {
    (authApi.getMyPvqStatus as jest.Mock).mockResolvedValue({
      isConfigured: true,
      question: "What is your pet's name?",
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("What is your pet's name?")).toBeTruthy();
    });
  });

  it("shows 'Set up' button when PVQ not configured", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("Set up")).toBeTruthy();
    });
  });

  it("shows 'Change' button when PVQ is configured", async () => {
    (authApi.getMyPvqStatus as jest.Mock).mockResolvedValue({
      isConfigured: true,
      question: "My question",
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getAllByText("Change").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens PVQ form when Set up is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Set up")).toBeTruthy());
    fireEvent.press(screen.getByText("Set up"));
    expect(screen.getByText("Security question")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. What was the name of your first pet?")).toBeTruthy();
  });

  it("closes PVQ form when Cancel is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Set up")).toBeTruthy());
    fireEvent.press(screen.getByText("Set up"));
    expect(screen.getByText("Security question")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByText("Security question")).toBeNull();
  });

  it("calls setupPvq with question and answer on save", async () => {
    (authApi.setupPvq as jest.Mock).mockResolvedValue({ ok: true, message: "Saved." });
    renderCard();
    await waitFor(() => expect(screen.getByText("Set up")).toBeTruthy());
    fireEvent.press(screen.getByText("Set up"));
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. What was the name of your first pet?"),
      "My question?"
    );
    fireEvent.changeText(screen.getByPlaceholderText("Your answer"), "my answer");
    await act(async () => {
      fireEvent.press(screen.getByText("Save Question"));
    });
    expect(authApi.setupPvq).toHaveBeenCalledWith("My question?", "my answer");
  });

  it("does not call setupPvq when question is empty", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Set up")).toBeTruthy());
    fireEvent.press(screen.getByText("Set up"));
    fireEvent.changeText(screen.getByPlaceholderText("Your answer"), "some answer");
    // question is empty, so Save Question should be disabled
    await act(async () => {
      fireEvent.press(screen.getByText("Save Question"));
    });
    expect(authApi.setupPvq).not.toHaveBeenCalled();
  });

  it("opens password form when Change password is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Change your admin password")).toBeTruthy());
    // Find the Change button for password (second Change button or the one in the password row)
    const changeBtns = screen.queryAllByText("Change");
    // Use the last one if multiple (first for PVQ, last for password if configured)
    // If PVQ not configured, only one Change: the password one
    if (changeBtns.length > 0) {
      fireEvent.press(changeBtns[changeBtns.length - 1]);
    } else {
      fireEvent.press(screen.getByText("Change"));
    }
    expect(screen.getByText("Current password")).toBeTruthy();
  });

  it("shows password mismatch error", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Change your admin password")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "current123");
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpass1");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "differentpass");
    await act(async () => {
      fireEvent.press(screen.getByText("Update Password"));
    });
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("disables Update Password when new password is too short", async () => {
    // The button is disabled when newPw.length < 6 — the inline length check in handleChangePw
    // is defensive but unreachable via UI since the button never enables below 6 chars.
    renderCard();
    await waitFor(() => expect(screen.getByText("Change your admin password")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    await waitFor(() => expect(screen.getByPlaceholderText("At least 6 characters")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "abc");
    // Button should be disabled — pressing it should not call changePassword
    fireEvent.press(screen.getByText("Update Password"));
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  it("closes password form when Cancel is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("Change your admin password")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    await waitFor(() => expect(screen.getByText("Current password")).toBeTruthy());
    // Press Cancel in the password form
    const cancelBtns = screen.queryAllByText("Cancel");
    fireEvent.press(cancelBtns[cancelBtns.length - 1]);
    await waitFor(() => expect(screen.queryByText("Current password")).toBeNull());
  });

  it("shows error when setupPvq fails", async () => {
    (authApi.setupPvq as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Failed to save question.",
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("Set up")).toBeTruthy());
    fireEvent.press(screen.getByText("Set up"));
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. What was the name of your first pet?"),
      "My question?"
    );
    fireEvent.changeText(screen.getByPlaceholderText("Your answer"), "my answer");
    await act(async () => {
      fireEvent.press(screen.getByText("Save Question"));
    });
    await waitFor(() => expect(screen.getByText("Failed to save question.")).toBeTruthy());
    expect(authApi.setupPvq).toHaveBeenCalledWith("My question?", "my answer");
  });

  it("calls changePassword and clears form on success", async () => {
    (authApi.changePassword as jest.Mock).mockResolvedValue({
      ok: true,
      message: "Password updated.",
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("Change your admin password")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "oldpass");
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpass");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "newpass");
    await act(async () => {
      fireEvent.press(screen.getByText("Update Password"));
    });
    expect(authApi.changePassword).toHaveBeenCalledWith("oldpass", "newpass");
    await waitFor(() => {
      expect(screen.getByText("Password updated.")).toBeTruthy();
    });
  });

  // ── Email row ────────────────────────────────────────────────────────────

  it("renders the current email from the auth context", async () => {
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("admin@test.com")).toBeTruthy();
    });
  });

  it("opens the email form when its Change button is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[0]);
    expect(screen.getByText("New email")).toBeTruthy();
  });

  it("closes the email form when Cancel is pressed", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[0]);
    expect(screen.getByText("New email")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByText("New email")).toBeNull();
  });

  it("disables Update Email until both fields are filled", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[0]);
    fireEvent.changeText(screen.getByPlaceholderText("new@email.com"), "new@test.com");
    fireEvent.press(screen.getByText("Update Email"));
    expect(authApi.changeEmail).not.toHaveBeenCalled();
  });

  it("calls changeEmail and updates the displayed email on success", async () => {
    (authApi.changeEmail as jest.Mock).mockResolvedValue({
      ok: true,
      message: "Email changed successfully.",
      email: "new@test.com",
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[0]);
    fireEvent.changeText(screen.getByPlaceholderText("new@email.com"), "new@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "currentpass");
    await act(async () => {
      fireEvent.press(screen.getByText("Update Email"));
    });
    expect(authApi.changeEmail).toHaveBeenCalledWith("currentpass", "new@test.com");
    await waitFor(() => {
      expect(screen.getByText("new@test.com")).toBeTruthy();
      expect(screen.getByText("Email changed successfully.")).toBeTruthy();
    });
    expect(screen.queryByText("New email")).toBeNull();
  });

  it("shows inline error and keeps old email when changeEmail fails", async () => {
    (authApi.changeEmail as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Current password is incorrect.",
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[0]);
    fireEvent.changeText(screen.getByPlaceholderText("new@email.com"), "new@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "wrongpass");
    await act(async () => {
      fireEvent.press(screen.getByText("Update Email"));
    });
    await waitFor(() => {
      expect(screen.getByText("Current password is incorrect.")).toBeTruthy();
    });
    expect(screen.getByText("admin@test.com")).toBeTruthy();
  });

  // ── Mutual exclusion across Email / PVQ / Password forms ───────────────────

  it("opening the password form closes an already-open email form", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const emailChangeBtns = screen.queryAllByText("Change");
    fireEvent.press(emailChangeBtns[0]);
    expect(screen.getByText("New email")).toBeTruthy();

    const changeBtnsAfterOpen = screen.queryAllByText("Change");
    fireEvent.press(changeBtnsAfterOpen[changeBtnsAfterOpen.length - 1]);

    expect(screen.queryByText("New email")).toBeNull();
    expect(screen.getByText("Update Password")).toBeTruthy();
  });

  it("opening the email form closes an already-open password form", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    expect(screen.getByText("Update Password")).toBeTruthy();

    const changeBtnsAfterOpen = screen.queryAllByText("Change");
    fireEvent.press(changeBtnsAfterOpen[0]);

    expect(screen.queryByText("Update Password")).toBeNull();
    expect(screen.getByText("New email")).toBeTruthy();
  });

  it("opening the security-question form closes an already-open email form", async () => {
    renderCard();
    await waitFor(() => expect(screen.getByText("admin@test.com")).toBeTruthy());
    const changeBtns = screen.queryAllByText("Change");
    fireEvent.press(changeBtns[0]);
    expect(screen.getByText("New email")).toBeTruthy();

    fireEvent.press(screen.getByText("Set up"));

    expect(screen.queryByText("New email")).toBeNull();
    expect(screen.getByText("Save Question")).toBeTruthy();
  });
});
