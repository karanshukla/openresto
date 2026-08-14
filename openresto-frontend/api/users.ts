import { get, patch, post } from "./client";
import type { AssignableRole } from "@/constants/roles";

/** An admin account as listed by the Owner-only user management API. */
export interface AdminUserDto {
  id: number;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  hasSecurityQuestion: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName?: string;
  role: AssignableRole;
}

export type UserMutationResult = { ok: true; user: AdminUserDto } | { ok: false; message: string };

async function toResult(res: Response): Promise<UserMutationResult> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: body.message ?? "Request failed." };
  }
  return { ok: true, user: body as AdminUserDto };
}

export async function adminListUsers(): Promise<AdminUserDto[] | null> {
  try {
    const res = await get("/admin/users");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminCreateUser(input: CreateUserInput): Promise<UserMutationResult> {
  try {
    return await toResult(await post("/admin/users", input));
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export async function adminUpdateUserRole(
  id: number,
  role: AssignableRole
): Promise<UserMutationResult> {
  try {
    return await toResult(await patch(`/admin/users/${id}/role`, { role }));
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export async function adminSetUserActive(
  id: number,
  isActive: boolean
): Promise<UserMutationResult> {
  try {
    return await toResult(await patch(`/admin/users/${id}/active`, { isActive }));
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export async function adminResetUserPassword(
  id: number,
  newPassword: string
): Promise<UserMutationResult> {
  try {
    return await toResult(await post(`/admin/users/${id}/reset-password`, { newPassword }));
  } catch {
    return { ok: false, message: "Network error." };
  }
}
