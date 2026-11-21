import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { checkSession, logout as logoutRequest, type AuthUser } from "@/api/auth";
import { roleCan, type Capability } from "@/constants/roles";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Re-reads `/admin/auth/me` and updates status. Returns the resolved status. */
  refresh: () => Promise<AuthStatus>;
  /** Applies an identity the caller already has (e.g. the email a change-email call returned). */
  setUser: (user: AuthUser) => void;
  signOut: () => Promise<void>;
  can: (capability: Capability) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the signed-in admin's identity for the whole admin app. It resolves the session once on
 * mount so any descendant can read `user` without a route having primed it; screens that change
 * the session (login, change-email) call `refresh`/`setUser` to push the new identity in.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async (): Promise<AuthStatus> => {
    const session = await checkSession();

    if (session === "rate-limited") {
      // Being throttled says nothing about the session, so hold whatever we already believed
      // rather than bouncing a signed-in admin to the login screen.
      const held: AuthStatus = status === "unauthenticated" ? "unauthenticated" : "authenticated";
      setStatus(held);
      return held;
    }

    if (session) {
      setUserState(session);
      setStatus("authenticated");
      return "authenticated";
    }

    setUserState(null);
    setStatus("unauthenticated");
    return "unauthenticated";
  }, [status]);

  // One resolve per mount. The ref guards React 18 StrictMode's double-invoked effects, which
  // would otherwise fire two /me requests on every admin page load.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    refresh();
    // Intentionally mount-only: `refresh` closes over `status`, so depending on it would
    // re-run this on every status transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUser = useCallback((next: AuthUser) => {
    setUserState(next);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setUserState(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      refresh,
      setUser,
      signOut,
      can: (capability: Capability) => roleCan(user?.role, capability),
    }),
    [user, status, refresh, setUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}

/**
 * The single seam for role-gating UI. Components ask what they may do, never what role the
 * user holds — so a new role or a permission matrix only changes `constants/roles.ts`.
 */
export function useCan(capability: Capability): boolean {
  return useAuth().can(capability);
}
