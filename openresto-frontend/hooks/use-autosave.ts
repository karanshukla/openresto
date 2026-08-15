import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/** Sends the payload. Resolves null when it saved, or the message to show when it didn't. */
export type AutosaveSaver<T> = (values: T) => Promise<string | null>;

export interface AutosaveOptions<T> {
  /** The payload as it would be sent right now. */
  values: T;
  /** What the server already holds, in the same shape as {@link values}. */
  saved: T;
  save: AutosaveSaver<T>;
  /**
   * Holds the save back while the form can't produce a valid payload — a half-typed hex colour
   * or an emptied app name would otherwise be written the moment the debounce elapsed.
   */
  canSave?: boolean;
  /** Quiet period after the last keystroke before the save fires. */
  delay?: number;
  /**
   * Puts a payload back into the form's own state. Supplying it is what enables undo: without a
   * way to move the inputs back, undoing would write the old values to the server while the form
   * carried on showing the new ones, and the next keystroke would simply save them again.
   */
  onRestore?: (values: T) => void;
  /** How long the undo stays on offer after a save lands. */
  undoWindow?: number;
}

export interface Autosave {
  status: AutosaveStatus;
  /** The failure message from the last attempt; null unless `status` is `error`. */
  error: string | null;
  retry: () => void;
  /**
   * Puts back what the last save replaced, in the form and on the server. Null when there is
   * nothing to undo: no save has landed, the window has passed, or the caller gave no
   * `onRestore`. Single level by design — it answers "that wasn't what I meant", not "walk me
   * back through my session".
   */
  undo: (() => void) | null;
}

const DEFAULT_DELAY = 800;
const DEFAULT_UNDO_WINDOW = 10_000;

/**
 * Saves a form as it is edited, replacing its Save button. A change starts a {@link DEFAULT_DELAY}
 * timer that each further change restarts, so a burst of typing is one write.
 *
 * The comparison that decides "is there anything to save" is between the serialised payload and
 * the serialised server value, which is what lets a card pass a fresh object literal every
 * render. `saved` alone isn't enough of a baseline: BrandContext doesn't refetch after a write,
 * so the last payload we committed stands in for it until the context reports something new.
 */
export function useAutosave<T>({
  values,
  saved,
  save,
  canSave = true,
  delay = DEFAULT_DELAY,
  onRestore,
  undoWindow = DEFAULT_UNDO_WINDOW,
}: AutosaveOptions<T>): Autosave {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  /** The serialised payload the last landed save replaced, while it is still on offer. */
  const [undoable, setUndoable] = useState<string | null>(null);

  const payload = JSON.stringify(values);
  const stored = JSON.stringify(saved);

  const latest = useRef({ values, save, onRestore });
  const committed = useRef<string | null>(null);
  /** A scheduled-but-unfired payload, flushed on unmount so navigating away doesn't drop it. */
  const pending = useRef<T | null>(null);
  const mounted = useRef(true);
  /** Only the newest attempt may write status — a slow save must not overwrite a newer result. */
  const attempt = useRef(0);
  /** What the in-flight save is about to replace, promoted to `undoable` once it lands. */
  const replacing = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { values, save, onRestore };
  });

  // A fresh server value supersedes whatever we last committed against it.
  useEffect(() => {
    committed.current = null;
  }, [stored]);

  const run = useCallback(async (next: T) => {
    pending.current = null;
    const id = ++attempt.current;
    setStatus("saving");
    setError(null);
    const replaced = replacing.current;
    const message = await latest.current.save(next);
    if (!mounted.current || id !== attempt.current) return;
    setStatus(message ? "error" : "saved");
    setError(message);
    // A failed write replaced nothing, so there is nothing to put back.
    setUndoable(message || !latest.current.onRestore ? null : replaced);
  }, []);

  useEffect(() => {
    const baseline = committed.current ?? stored;
    if (!canSave || payload === baseline) {
      pending.current = null;
      return;
    }
    const next = JSON.parse(payload) as T;
    pending.current = next;
    // An edit invalidates whatever the indicator was reporting about the previous one.
    setStatus((current) => (current === "saving" ? current : "idle"));
    const timer = setTimeout(() => {
      replacing.current = baseline;
      committed.current = payload;
      void run(next);
    }, delay);
    return () => clearTimeout(timer);
  }, [payload, stored, canSave, delay, run]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pending.current) void latest.current.save(pending.current);
    };
  }, []);

  // The offer is deliberately short-lived: an "Undo" that lingers reads as a pending action
  // rather than as a receipt for one that already completed.
  useEffect(() => {
    if (undoable === null) return;
    const timer = setTimeout(() => setUndoable(null), undoWindow);
    return () => clearTimeout(timer);
  }, [undoable, undoWindow]);

  const retry = useCallback(() => {
    committed.current = JSON.stringify(latest.current.values);
    void run(latest.current.values);
  }, [run]);

  const undo = useCallback(() => {
    const target = undoable;
    const restore = latest.current.onRestore;
    if (target === null || !restore) return;
    const previous = JSON.parse(target) as T;
    // Committing first is what stops the restored values from being detected as a fresh edit and
    // written a second time by the debounce: the form settles back onto its own baseline.
    committed.current = target;
    replacing.current = null;
    setUndoable(null);
    restore(previous);
    void run(previous);
  }, [undoable, run]);

  return { status, error, retry, undo: undoable !== null ? undo : null };
}
