import React from "react";
import { Platform } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ApiKeySecretModal } from "@/components/admin/settings/ApiKeySecretModal";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));

Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

describe("ApiKeySecretModal", () => {
  const secret = "orst_12_thefullsecretvalue";

  it("shows the secret and the one-time warning", () => {
    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);

    expect(screen.getByTestId("api-key-secret-value")).toHaveTextContent(secret);
    expect(screen.getByText(/This is the only time you'll see this key in full/)).toBeTruthy();
  });

  it("copies the secret to the clipboard on web and shows a copied confirmation", async () => {
    const mockClipboard = jest.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockClipboard },
      configurable: true,
    });

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));

    expect(mockClipboard).toHaveBeenCalledWith(secret);
    await waitFor(() => expect(screen.getByLabelText("API key copied")).toBeTruthy());
  });

  it("reverts to the plain copy label after the confirmation window", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn() },
      configurable: true,
    });

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));
    await waitFor(() => expect(screen.getByLabelText("API key copied")).toBeTruthy());

    await waitFor(() => expect(screen.getByLabelText("Copy API key to clipboard")).toBeTruthy(), {
      timeout: 3000,
    });
  });

  it("hides the copy button off web", () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    try {
      render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
      expect(screen.queryByLabelText("Copy API key to clipboard")).toBeNull();
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("calls onDismiss when Done is pressed", () => {
    const onDismiss = jest.fn();
    render(<ApiKeySecretModal visible secret={secret} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText("Done, I've saved it"));

    expect(onDismiss).toHaveBeenCalled();
  });
});
