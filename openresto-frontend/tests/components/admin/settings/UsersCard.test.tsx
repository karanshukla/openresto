import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { UsersCard } from "@/components/admin/settings/UsersCard";
import { AuthProvider } from "@/context/AuthContext";
import * as usersApi from "@/api/users";
import { checkSession } from "@/api/auth";
import type { AdminUserDto } from "@/api/users";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("@/api/users", () => ({
  adminListUsers: jest.fn(),
  adminCreateUser: jest.fn(),
  adminUpdateUserRole: jest.fn(),
  adminSetUserActive: jest.fn(),
  adminResetUserPassword: jest.fn(),
}));

jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
  logout: jest.fn(),
}));

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

const OWNER: AdminUserDto = {
  id: 1,
  email: "owner@test.com",
  displayName: "Olive Owner",
  role: "Owner",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  hasSecurityQuestion: true,
};

const MANAGER: AdminUserDto = {
  id: 2,
  email: "manager@test.com",
  displayName: null,
  role: "Manager",
  isActive: true,
  createdAt: "2026-02-01T00:00:00Z",
  hasSecurityQuestion: false,
};

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };

const renderCard = () =>
  render(
    <AuthProvider>
      <UsersCard {...baseProps} />
    </AuthProvider>
  );

/** Renders and waits for the list fetch to settle. */
async function renderLoaded() {
  const view = renderCard();
  await waitFor(() => expect(screen.getByText("owner@test.com")).toBeTruthy());
  return view;
}

describe("UsersCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkSession as jest.Mock).mockResolvedValue({
      id: OWNER.id,
      email: OWNER.email,
      displayName: OWNER.displayName,
      role: OWNER.role,
    });
    (usersApi.adminListUsers as jest.Mock).mockResolvedValue([OWNER, MANAGER]);
  });

  it("lists every account with its role", async () => {
    await renderLoaded();

    expect(screen.getByText("Olive Owner")).toBeTruthy();
    // The manager has no display name, so the email stands in as the title *and* the subtitle.
    expect(screen.getAllByText("manager@test.com").length).toBeGreaterThan(0);
    expect(screen.getByText("2 accounts · Owners can manage users")).toBeTruthy();
  });

  it("says 1 account, not 1 accounts, for a single-user instance", async () => {
    (usersApi.adminListUsers as jest.Mock).mockResolvedValue([OWNER]);
    await renderLoaded();

    expect(screen.getByText("1 account · Owners can manage users")).toBeTruthy();
  });

  it("marks a deactivated account", async () => {
    (usersApi.adminListUsers as jest.Mock).mockResolvedValue([
      OWNER,
      { ...MANAGER, isActive: false },
    ]);
    await renderLoaded();

    expect(screen.getByText("Deactivated")).toBeTruthy();
  });

  it("survives a refused list without crashing", async () => {
    (usersApi.adminListUsers as jest.Mock).mockResolvedValue(null);
    renderCard();

    await waitFor(() =>
      expect(screen.getByText("0 accounts · Owners can manage users")).toBeTruthy()
    );
  });

  it("tells you which row is you", async () => {
    await renderLoaded();

    expect(
      screen.getByText("This is you — change your own password under Account Security.")
    ).toBeTruthy();
  });

  it("offers no deactivate control for your own row", async () => {
    await renderLoaded();

    expect(screen.queryByLabelText("Deactivate owner@test.com")).toBeNull();
    expect(screen.getByLabelText("Deactivate manager@test.com")).toBeTruthy();
  });

  // ── Create ───────────────────────────────────────────────────────────────

  const openAddForm = async () => {
    fireEvent.press(screen.getByLabelText("Add user"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("colleague@restaurant.com")).toBeTruthy()
    );
  };

  const fillNewUser = (email: string, password: string) => {
    fireEvent.changeText(screen.getByPlaceholderText("colleague@restaurant.com"), email);
    fireEvent.changeText(screen.getByPlaceholderText("Alex Rivera"), "New Person");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), password);
  };

  it("creates a user and adds them to the list", async () => {
    const created = { ...MANAGER, id: 3, email: "new@test.com", displayName: "New Person" };
    (usersApi.adminCreateUser as jest.Mock).mockResolvedValue({ ok: true, user: created });
    await renderLoaded();
    await openAddForm();
    fillNewUser("new@test.com", "temp-password");

    fireEvent.press(screen.getByText("Create user"));

    await waitFor(() => expect(screen.getByText("new@test.com can now sign in.")).toBeTruthy());
    expect(usersApi.adminCreateUser).toHaveBeenCalledWith({
      email: "new@test.com",
      password: "temp-password",
      displayName: "New Person",
      role: "Manager",
    });
    expect(screen.getByText("New Person")).toBeTruthy();
  });

  it("creates an Owner when that role is picked", async () => {
    (usersApi.adminCreateUser as jest.Mock).mockResolvedValue({
      ok: true,
      user: { ...MANAGER, id: 4, role: "Owner" },
    });
    await renderLoaded();
    await openAddForm();
    fillNewUser("new@test.com", "temp-password");
    fireEvent.press(screen.getByLabelText("New user role Owner"));

    fireEvent.press(screen.getByText("Create user"));

    await waitFor(() =>
      expect(usersApi.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: "Owner" })
      )
    );
  });

  it("omits a blank display name rather than sending an empty string", async () => {
    (usersApi.adminCreateUser as jest.Mock).mockResolvedValue({ ok: true, user: MANAGER });
    await renderLoaded();
    await openAddForm();
    fireEvent.changeText(screen.getByPlaceholderText("colleague@restaurant.com"), "new@test.com");
    fireEvent.changeText(screen.getByPlaceholderText("Alex Rivera"), "   ");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "temp-password");

    fireEvent.press(screen.getByText("Create user"));

    await waitFor(() =>
      expect(usersApi.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: undefined })
      )
    );
  });

  it("rejects a malformed email before calling the API", async () => {
    await renderLoaded();
    await openAddForm();
    fillNewUser("not-an-email", "temp-password");

    fireEvent.press(screen.getByText("Create user"));

    await waitFor(() => expect(screen.getByText("Enter a valid email address.")).toBeTruthy());
    expect(usersApi.adminCreateUser).not.toHaveBeenCalled();
  });

  it("rejects a short password before calling the API", async () => {
    await renderLoaded();
    await openAddForm();
    fillNewUser("new@test.com", "123");

    fireEvent.press(screen.getByText("Create user"));

    await waitFor(() =>
      expect(screen.getByText("Password must be at least 6 characters.")).toBeTruthy()
    );
    expect(usersApi.adminCreateUser).not.toHaveBeenCalled();
  });

  it("surfaces a server rejection verbatim", async () => {
    (usersApi.adminCreateUser as jest.Mock).mockResolvedValue({
      ok: false,
      message: "An account with that email address already exists.",
    });
    await renderLoaded();
    await openAddForm();
    fillNewUser("owner@test.com", "temp-password");

    fireEvent.press(screen.getByText("Create user"));

    await waitFor(() =>
      expect(screen.getByText("An account with that email address already exists.")).toBeTruthy()
    );
  });

  it("closes the add form on cancel", async () => {
    await renderLoaded();
    await openAddForm();

    fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText("colleague@restaurant.com")).toBeNull()
    );
  });

  // ── Role changes ─────────────────────────────────────────────────────────

  it("promotes a manager", async () => {
    (usersApi.adminUpdateUserRole as jest.Mock).mockResolvedValue({
      ok: true,
      user: { ...MANAGER, role: "Owner" },
    });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Make manager@test.com Owner"));

    await waitFor(() => expect(screen.getByText("manager@test.com is now Owner.")).toBeTruthy());
    expect(usersApi.adminUpdateUserRole).toHaveBeenCalledWith(MANAGER.id, "Owner");
  });

  it("surfaces the last-Owner guard on a demotion", async () => {
    (usersApi.adminUpdateUserRole as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Cannot demote the last active Owner — promote another user first.",
    });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Make owner@test.com Manager"));

    await waitFor(() =>
      expect(
        screen.getByText("Cannot demote the last active Owner — promote another user first.")
      ).toBeTruthy()
    );
  });

  // ── Activation ───────────────────────────────────────────────────────────

  it("deactivates and reactivates another account", async () => {
    (usersApi.adminSetUserActive as jest.Mock).mockResolvedValueOnce({
      ok: true,
      user: { ...MANAGER, isActive: false },
    });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Deactivate manager@test.com"));

    await waitFor(() => expect(screen.getByText("manager@test.com deactivated.")).toBeTruthy());
    expect(usersApi.adminSetUserActive).toHaveBeenCalledWith(MANAGER.id, false);

    (usersApi.adminSetUserActive as jest.Mock).mockResolvedValueOnce({ ok: true, user: MANAGER });
    fireEvent.press(screen.getByLabelText("Reactivate manager@test.com"));

    await waitFor(() => expect(screen.getByText("manager@test.com reactivated.")).toBeTruthy());
  });

  // ── Password reset ───────────────────────────────────────────────────────

  it("sets a new password for another account", async () => {
    (usersApi.adminResetUserPassword as jest.Mock).mockResolvedValue({ ok: true, user: MANAGER });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Set a new password for manager@test.com"));
    await waitFor(() => expect(screen.getByText("Set password")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "owner-issued");
    fireEvent.press(screen.getByText("Set password"));

    await waitFor(() =>
      expect(
        screen.getByText("New password set for manager@test.com. Share it out of band.")
      ).toBeTruthy()
    );
    expect(usersApi.adminResetUserPassword).toHaveBeenCalledWith(MANAGER.id, "owner-issued");
  });

  it("rejects a short reset password before calling the API", async () => {
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Set a new password for manager@test.com"));
    await waitFor(() => expect(screen.getByText("Set password")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "123");
    fireEvent.press(screen.getByText("Set password"));

    await waitFor(() =>
      expect(screen.getByText("Password must be at least 6 characters.")).toBeTruthy()
    );
    expect(usersApi.adminResetUserPassword).not.toHaveBeenCalled();
  });

  it("keeps the reset form open when the server refuses", async () => {
    (usersApi.adminResetUserPassword as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Password must be at least 6 characters.",
    });
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Set a new password for manager@test.com"));
    await waitFor(() => expect(screen.getByText("Set password")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "long-enough");
    fireEvent.press(screen.getByText("Set password"));

    await waitFor(() =>
      expect(screen.getByText("Password must be at least 6 characters.")).toBeTruthy()
    );
    expect(screen.getByText("Set password")).toBeTruthy();
  });

  it("closes the reset form on cancel", async () => {
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Set a new password for manager@test.com"));
    await waitFor(() => expect(screen.getByText("Set password")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() => expect(screen.queryByText("Set password")).toBeNull());
  });

  it("toggles the reset form off when its own button is pressed again", async () => {
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Set a new password for manager@test.com"));
    await waitFor(() => expect(screen.getByText("Set password")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Set a new password for manager@test.com"));

    await waitFor(() => expect(screen.queryByText("Set password")).toBeNull());
  });

  it("collapses when the header is pressed", async () => {
    await renderLoaded();

    fireEvent.press(screen.getByLabelText("Users"));

    await waitFor(() =>
      expect(screen.getByLabelText("Users").props.accessibilityState).toEqual({
        expanded: false,
      })
    );
  });
});
