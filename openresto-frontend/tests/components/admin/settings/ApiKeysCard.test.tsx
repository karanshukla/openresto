import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ApiKeysCard } from "@/components/admin/settings/ApiKeysCard";
import * as apiKeysApi from "@/api/apiKeys";
import type { ApiKeyDto, CreatedApiKey } from "@/api/apiKeys";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("@/api/apiKeys", () => {
  const actual = jest.requireActual("@/api/apiKeys");
  return {
    ...actual,
    adminListApiKeys: jest.fn(),
    adminCreateApiKey: jest.fn(),
    adminRevokeApiKey: jest.fn(),
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const BOOKINGS_KEY: ApiKeyDto = {
  id: 1,
  name: "Reservations widget",
  prefix: "orst_12",
  scopes: [
    { resource: "bookings", access: "read" },
    { resource: "bookings", access: "write" },
  ],
  createdAt: "2026-01-01T12:00:00Z",
  lastUsedAt: "2026-02-15T09:30:00Z",
  expiresAt: null,
  revokedAt: null,
};

const AUDIT_KEY: ApiKeyDto = {
  id: 2,
  name: "Reporting export",
  prefix: "orst_99",
  scopes: [{ resource: "audit", access: "read" }],
  createdAt: "2026-01-05T00:00:00Z",
  lastUsedAt: null,
  expiresAt: "2026-06-01T00:00:00Z",
  revokedAt: null,
};

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };

const renderCard = () => render(<ApiKeysCard {...baseProps} />);

/** Renders and waits for the list fetch to settle. */
async function renderLoaded() {
  const view = renderCard();
  await waitFor(() => expect(screen.getByText("Reservations widget")).toBeTruthy());
  return view;
}

describe("ApiKeysCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiKeysApi.adminListApiKeys as jest.Mock).mockResolvedValue([BOOKINGS_KEY, AUDIT_KEY]);
  });

  // ── Listing ──────────────────────────────────────────────────────────────

  it("lists every key with its prefix and scopes", async () => {
    await renderLoaded();

    expect(screen.getByText("orst_12…")).toBeTruthy();
    expect(screen.getByText("Reporting export")).toBeTruthy();
    expect(screen.getByText("Bookings · Read")).toBeTruthy();
    expect(screen.getByText("Bookings · Write")).toBeTruthy();
    expect(screen.getByText("Activity log · Read")).toBeTruthy();
    expect(screen.getByText("2 keys · Scoped access for other services")).toBeTruthy();
  });

  it("says 1 key, not 1 keys, for a single key", async () => {
    (apiKeysApi.adminListApiKeys as jest.Mock).mockResolvedValue([BOOKINGS_KEY]);
    await renderLoaded();

    expect(screen.getByText("1 key · Scoped access for other services")).toBeTruthy();
  });

  it("shows last-used and never-used states", async () => {
    await renderLoaded();

    expect(screen.getByText(/Last used/)).toBeTruthy();
    expect(screen.getByText("Never used")).toBeTruthy();
  });

  it("shows an expiry date only for a key that has one", async () => {
    await renderLoaded();

    expect(screen.getByText(/Expires/)).toBeTruthy();
  });

  it("says a refused list failed rather than showing zero keys", async () => {
    (apiKeysApi.adminListApiKeys as jest.Mock).mockResolvedValue(null);
    renderCard();

    await waitFor(() =>
      expect(screen.getByText("Could not load API keys. Reload to try again.")).toBeTruthy()
    );
    expect(screen.getByText("0 keys · Scoped access for other services")).toBeTruthy();
  });

  // ── Create ───────────────────────────────────────────────────────────────

  const openAddForm = async () => {
    fireEvent.press(screen.getByLabelText("Add API key"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Reservations widget")).toBeTruthy()
    );
  };

  it("rejects an empty name before calling the API", async () => {
    await renderLoaded();
    await openAddForm();

    fireEvent.press(screen.getByLabelText("Read access to Bookings"));
    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() => expect(screen.getByText("Give the key a name.")).toBeTruthy());
    expect(apiKeysApi.adminCreateApiKey).not.toHaveBeenCalled();
  });

  it("rejects a key with no scope selected", async () => {
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "New service");

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() => expect(screen.getByText("Select at least one permission.")).toBeTruthy());
    expect(apiKeysApi.adminCreateApiKey).not.toHaveBeenCalled();
  });

  it("does not offer a write toggle for the read-only audit resource", async () => {
    await renderLoaded();
    await openAddForm();

    expect(screen.queryByLabelText("Write access to Activity log")).toBeNull();
    expect(screen.getByLabelText("Read access to Activity log")).toBeTruthy();
  });

  it("does not offer a write toggle for the read-only guests resource", async () => {
    await renderLoaded();
    await openAddForm();

    expect(screen.queryByLabelText("Write access to Guests")).toBeNull();
    expect(screen.getByLabelText("Read access to Guests")).toBeTruthy();
  });

  it("creates a key with the selected scopes and shows the secret once", async () => {
    const created: CreatedApiKey = {
      id: 3,
      name: "New service",
      prefix: "orst_55",
      scopes: [{ resource: "bookings", access: "read" }],
      createdAt: "2026-03-01T00:00:00Z",
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      secret: "orst_55_thefullsecretvalue",
    };
    (apiKeysApi.adminCreateApiKey as jest.Mock).mockResolvedValue({ ok: true, key: created });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "New service");
    fireEvent.press(screen.getByLabelText("Read access to Bookings"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() => expect(screen.getByText('"New service" created.')).toBeTruthy());
    // Default preset is 1 year, so an explicit expiresAt goes out even though the caller
    // never touched the expiry field.
    const call = (apiKeysApi.adminCreateApiKey as jest.Mock).mock.calls[0][0];
    expect(call).toEqual(
      expect.objectContaining({
        name: "New service",
        scopes: [{ resource: "bookings", access: "read" }],
      })
    );
    expect(typeof call.expiresAt).toBe("string");
    expect(call.neverExpires).toBeUndefined();
    // The secret modal opens showing the full value exactly once.
    expect(screen.getByTestId("api-key-secret-value")).toHaveTextContent(
      "orst_55_thefullsecretvalue"
    );

    fireEvent.press(screen.getByText("Done, I've saved it"));
    await waitFor(() => expect(screen.queryByTestId("api-key-secret-modal")).toBeNull());
  });

  // A write grant already satisfies a read requirement server-side, so the form grants one
  // level per resource rather than two independent checkboxes. These three pin that: write
  // travels alone, moving the level replaces the previous grant, and None takes it away.
  it("sends the write scope alone when Write is picked, never a redundant read alongside it", async () => {
    (apiKeysApi.adminCreateApiKey as jest.Mock).mockResolvedValue({
      ok: true,
      key: { ...BOOKINGS_KEY, id: 9, secret: "orst_09_x" },
    });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "Full access");
    fireEvent.press(screen.getByLabelText("Write access to Bookings"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() =>
      expect(apiKeysApi.adminCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ scopes: [{ resource: "bookings", access: "write" }] })
      )
    );
  });

  it("replaces the previous level rather than accumulating when Read is changed to Write", async () => {
    (apiKeysApi.adminCreateApiKey as jest.Mock).mockResolvedValue({
      ok: true,
      key: { ...BOOKINGS_KEY, id: 9, secret: "orst_09_x" },
    });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "Full access");
    fireEvent.press(screen.getByLabelText("Read access to Bookings"));
    fireEvent.press(screen.getByLabelText("Write access to Bookings"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() =>
      expect(apiKeysApi.adminCreateApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ scopes: [{ resource: "bookings", access: "write" }] })
      )
    );
  });

  it("takes the grant away again when a resource is set back to No access", async () => {
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "Nothing");
    fireEvent.press(screen.getByLabelText("Read access to Bookings"));
    fireEvent.press(screen.getByLabelText("No access to Bookings"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() => expect(screen.getByText("Select at least one permission.")).toBeTruthy());
    expect(apiKeysApi.adminCreateApiKey).not.toHaveBeenCalled();
  });

  it("sends a computed expiry when a preset other than no-expiry is chosen", async () => {
    (apiKeysApi.adminCreateApiKey as jest.Mock).mockResolvedValue({
      ok: true,
      key: { ...BOOKINGS_KEY, id: 9, secret: "orst_09_x" },
    });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "Temp service");
    fireEvent.press(screen.getByLabelText("Read access to Bookings"));
    fireEvent.press(screen.getByLabelText("30 days"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() => expect(apiKeysApi.adminCreateApiKey).toHaveBeenCalled());
    const call = (apiKeysApi.adminCreateApiKey as jest.Mock).mock.calls[0][0];
    expect(typeof call.expiresAt).toBe("string");
    expect(new Date(call.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(call.neverExpires).toBeUndefined();
  });

  it("defaults the expiry preset to 1 year", async () => {
    await renderLoaded();
    await openAddForm();

    expect(screen.getByLabelText("1 year").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("No expiry").props.accessibilityState.checked).toBe(false);
  });

  it("sends neverExpires and no expiresAt when No expiry is chosen explicitly", async () => {
    (apiKeysApi.adminCreateApiKey as jest.Mock).mockResolvedValue({
      ok: true,
      key: { ...BOOKINGS_KEY, id: 9, secret: "orst_09_x", expiresAt: null },
    });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Reservations widget"),
      "Forever service"
    );
    fireEvent.press(screen.getByLabelText("Read access to Bookings"));
    fireEvent.press(screen.getByLabelText("No expiry"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() =>
      expect(apiKeysApi.adminCreateApiKey).toHaveBeenCalledWith({
        name: "Forever service",
        scopes: [{ resource: "bookings", access: "read" }],
        neverExpires: true,
      })
    );
  });

  it("surfaces a server rejection verbatim", async () => {
    (apiKeysApi.adminCreateApiKey as jest.Mock).mockResolvedValue({
      ok: false,
      message: "A key with that name already exists.",
    });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Reservations widget"), "Dup");
    fireEvent.press(screen.getByLabelText("Read access to Bookings"));

    fireEvent.press(screen.getByLabelText("Add this key"));

    await waitFor(() =>
      expect(screen.getByText("A key with that name already exists.")).toBeTruthy()
    );
  });

  it("closes the add form on cancel", async () => {
    await renderLoaded();
    await openAddForm();

    fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText("e.g. Reservations widget")).toBeNull()
    );
  });

  // ── Revoke ───────────────────────────────────────────────────────────────

  it("asks for confirmation before revoking, and does nothing on cancel", async () => {
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Revoke Reservations widget"));
    await waitFor(() => expect(screen.getByText("Revoke this key?")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() => expect(screen.queryByText("Revoke this key?")).toBeNull());
    expect(apiKeysApi.adminRevokeApiKey).not.toHaveBeenCalled();
  });

  it("revokes a key on confirmation and marks it revoked distinctly", async () => {
    (apiKeysApi.adminRevokeApiKey as jest.Mock).mockResolvedValue({
      ok: true,
      key: { ...BOOKINGS_KEY, revokedAt: "2026-03-01T00:00:00Z" },
    });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Revoke Reservations widget"));
    await waitFor(() => expect(screen.getByText("Revoke this key?")).toBeTruthy());
    fireEvent.press(screen.getByText("Revoke key"));

    await waitFor(() => expect(screen.getByText('"Reservations widget" revoked.')).toBeTruthy());
    expect(screen.getByText("Revoked")).toBeTruthy();
    expect(screen.queryByLabelText("Revoke Reservations widget")).toBeNull();
  });

  it("falls back to marking the row revoked locally when the server answers with no body", async () => {
    (apiKeysApi.adminRevokeApiKey as jest.Mock).mockResolvedValue({ ok: true, key: null });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Revoke Reservations widget"));
    await waitFor(() => expect(screen.getByText("Revoke this key?")).toBeTruthy());
    fireEvent.press(screen.getByText("Revoke key"));

    await waitFor(() => expect(screen.getByText("Revoked")).toBeTruthy());
  });

  it("surfaces a revoke rejection", async () => {
    (apiKeysApi.adminRevokeApiKey as jest.Mock).mockResolvedValue({
      ok: false,
      message: "That key is already revoked.",
    });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Revoke Reservations widget"));
    await waitFor(() => expect(screen.getByText("Revoke this key?")).toBeTruthy());
    fireEvent.press(screen.getByText("Revoke key"));

    await waitFor(() => expect(screen.getByText("That key is already revoked.")).toBeTruthy());
  });

  // ── Accordion ────────────────────────────────────────────────────────────

  it("collapses when the header is pressed", async () => {
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("API Keys"));

    await waitFor(() =>
      expect(screen.getByLabelText("API Keys").props.accessibilityState).toEqual({
        expanded: false,
      })
    );
  });
});
