import i18n from "@/i18n";

/**
 * The shape every rejected OpenResto request returns. `message` is the backend's English
 * sentence, `code` the stable `ErrorCodes` identifier for the rule that rejected it, and
 * `args` the values `message` interpolated, keyed by placeholder name. Only `message` is
 * guaranteed: `code` is absent on the handful of throw sites that predate it, and `args`
 * only appears where the message is not a constant.
 */
export interface ApiErrorBody {
  message?: string;
  code?: string;
  args?: Record<string, string | number>;
}

/**
 * The message to show a viewer for a rejected request, in their language.
 *
 * The backend's `message` is always English, so rendering it directly is what left a French
 * guest reading "This table is no longer available." Translating from `code` instead keeps the
 * whole rejection in one language, and `args` is what lets the translated sentence name the
 * same seats, limits and times the English one did.
 *
 * Falls back to the server's own wording for a code with no copy yet — and to `fallback` when
 * the response carried no message at all — so an unlocalized rule degrades to today's English
 * rather than to a raw key.
 *
 * @see [errors.test.ts](../tests/api/errors.test.ts) — pins that a known code translates, that
 * args interpolate into it, and that an unknown code keeps the server's message.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  const { message, code, args } = (body ?? {}) as ApiErrorBody;
  const serverMessage = message ?? fallback;

  if (!code) return serverMessage;

  // The (key, defaultValue, options) overload takes a plain string key — `t()`'s other
  // overload is typed against en.json's key union, which a runtime error code cannot satisfy.
  return i18n.t(`errors.${code}`, serverMessage, { ...args, defaultValue: serverMessage });
}
