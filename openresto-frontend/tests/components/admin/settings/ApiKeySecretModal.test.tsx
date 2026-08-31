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

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

describe("ApiKeySecretModal", () => {
  const secret = "orst_12_thefullsecretvalue";

  it("shows the secret and the one-time warning", () => {
    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);

    expect(screen.getByTestId("api-key-secret-value")).toHaveTextContent(secret);
    expect(screen.getByText(/This is the only time you'll see this key in full/)).toBeTruthy();
  });

  it("copies the secret to the clipboard on web and shows a copied confirmation", async () => {
    const mockClipboard = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText: mockClipboard });

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));

    expect(mockClipboard).toHaveBeenCalledWith(secret);
    await waitFor(() => expect(screen.getByLabelText("API key copied")).toBeTruthy());
    expect(screen.queryByTestId("api-key-secret-copy-failed")).toBeNull();
  });

  it("reverts to the plain copy label after the confirmation window", async () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));
    await waitFor(() => expect(screen.getByLabelText("API key copied")).toBeTruthy());

    await waitFor(() => expect(screen.getByLabelText("Copy API key to clipboard")).toBeTruthy(), {
      timeout: 3000,
    });
  });

  // The secret is shown once and never again, so a confirmation the clipboard never earned
  // sends the admin away from the only screen that has it.
  it("does not confirm the copy when the browser exposes no clipboard", async () => {
    setClipboard(undefined);

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));

    await waitFor(() => expect(screen.getByTestId("api-key-secret-copy-failed")).toBeTruthy());
    expect(screen.queryByLabelText("API key copied")).toBeNull();
    expect(screen.getByLabelText("Copy API key to clipboard")).toBeTruthy();
  });

  it("does not confirm the copy when the clipboard write is rejected", async () => {
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error("NotAllowedError")) });

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));

    await waitFor(() => expect(screen.getByTestId("api-key-secret-copy-failed")).toBeTruthy());
    expect(screen.queryByLabelText("API key copied")).toBeNull();
  });

  it("tells the reader to select the secret by hand when the copy failed", async () => {
    setClipboard(undefined);

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));

    await waitFor(() =>
      expect(screen.getByText(/Select the key above and copy it manually/)).toBeTruthy()
    );
    expect(screen.getByTestId("api-key-secret-value").props.selectable).toBe(true);
  });

  it("clears the failure once a later copy succeeds", async () => {
    const writeText = jest
      .fn()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    setClipboard({ writeText });

    render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));
    await waitFor(() => expect(screen.getByTestId("api-key-secret-copy-failed")).toBeTruthy());

    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));

    await waitFor(() => expect(screen.getByLabelText("API key copied")).toBeTruthy());
    expect(screen.queryByTestId("api-key-secret-copy-failed")).toBeNull();
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

  it("drops its pending confirmation timer on unmount", async () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const view = render(<ApiKeySecretModal visible secret={secret} onDismiss={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Copy API key to clipboard"));
    await waitFor(() => expect(screen.getByLabelText("API key copied")).toBeTruthy());
    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("calls onDismiss when Done is pressed", () => {
    const onDismiss = jest.fn();
    render(<ApiKeySecretModal visible secret={secret} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText("Done, I've saved it"));

    expect(onDismiss).toHaveBeenCalled();
  });
});
