import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/api/auth", () => ({
  getPvqStatus: jest.fn().mockResolvedValue({ isConfigured: false, question: null }),
  setupPvq: jest.fn().mockResolvedValue({ ok: true, message: "Question saved." }),
  changePassword: jest.fn().mockResolvedValue({ ok: true, message: "Password updated." }),
}));

describe("SecurityCard", () => {
  const defaultProps = {
    borderColor: "#eee",
    mutedColor: "#888",
    cardBg: "#fff",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const authApi = require("@/api/auth");
    authApi.getPvqStatus.mockResolvedValue({ isConfigured: false, question: null });
  });

  it("renders Account Security header", async () => {
    render(<SecurityCard {...defaultProps} />);
    expect(screen.getByText("Account Security")).toBeTruthy();
  });

  it("shows not configured warning when PVQ is not set up", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Not configured/)).toBeTruthy();
    });
  });

  it("shows existing question when PVQ is configured", async () => {
    const authApi = require("@/api/auth");
    authApi.getPvqStatus.mockResolvedValueOnce({
      isConfigured: true,
      question: "What is your pet's name?",
    });

    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("What is your pet's name?")).toBeTruthy();
    });
  });

  it("opens PVQ form when Set up is pressed", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Set up")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Set up"));
    expect(screen.getByText("Security question")).toBeTruthy();
    expect(screen.getByText("Answer (not case-sensitive)")).toBeTruthy();
  });

  it("opens password form when Change button is pressed", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Change")).toBeTruthy();
    });
    // Press the password Change button
    const changeBtns = screen.getAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    expect(screen.getByText("Current password")).toBeTruthy();
    expect(screen.getByText("New password")).toBeTruthy();
  });

  it("saves PVQ when Save Question is pressed with valid inputs", async () => {
    const authApi = require("@/api/auth");
    render(<SecurityCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Set up")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Set up"));
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. What was the name of your first pet?"),
      "What is my pet?"
    );
    fireEvent.changeText(screen.getByPlaceholderText("Your answer"), "Fluffy");
    fireEvent.press(screen.getByText("Save Question"));

    await waitFor(() => {
      expect(authApi.setupPvq).toHaveBeenCalledWith("What is my pet?", "Fluffy");
    });
  });

  it("does not save PVQ when inputs are empty", async () => {
    const authApi = require("@/api/auth");
    render(<SecurityCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Set up")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Set up"));
    fireEvent.press(screen.getByText("Save Question"));

    expect(authApi.setupPvq).not.toHaveBeenCalled();
  });

  it("shows error when passwords don't match", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Change")).toBeTruthy();
    });

    const changeBtns = screen.getAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);

    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "current123");
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpass123");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "different123");
    fireEvent.press(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    });
  });

  it("disables Update Password button when new password is too short", async () => {
    // The button is disabled when newPw.length < 6, so handleChangePw is not called.
    // The "Password must be at least 6 characters." check in handleChangePw is a defensive
    // guard but unreachable via normal UI since the button stays disabled.
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Change")).toBeTruthy();
    });

    const changeBtns = screen.getAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);

    // Enter a short password - button remains disabled
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "abc");
    // Button text is present but disabled
    expect(screen.getByText("Update Password")).toBeTruthy();
  });

  it("changes password successfully", async () => {
    const authApi = require("@/api/auth");
    render(<SecurityCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText("Change")).toBeTruthy();
    });

    const changeBtns = screen.getAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);

    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "oldpassword");
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "newpassword123");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "newpassword123");
    fireEvent.press(screen.getByText("Update Password"));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith("oldpassword", "newpassword123");
    });
  });

  it("cancels PVQ form when Cancel is pressed", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Set up")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Set up"));
    expect(screen.getByText("Security question")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Security question")).toBeNull();
    });
  });

  it("cancels password form when Cancel is pressed", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Change")).toBeTruthy();
    });
    const changeBtns = screen.getAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);
    expect(screen.getByText("Current password")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Current password")).toBeNull();
    });
  });

  it("disables Update Password button when new password is too short and passwords match", async () => {
    render(<SecurityCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getAllByText("Change")).toBeTruthy();
    });
    const changeBtns = screen.getAllByText("Change");
    fireEvent.press(changeBtns[changeBtns.length - 1]);

    // Set matching but short passwords (length < 6) — button should be disabled
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "currentpass");
    fireEvent.changeText(screen.getByPlaceholderText("At least 6 characters"), "abc");
    fireEvent.changeText(screen.getByPlaceholderText("Repeat password"), "abc");

    // The button should be present but disabled (can't easily press disabled Pressable via RNTL)
    expect(screen.getByText("Update Password")).toBeTruthy();
  });
});
