/** The message the widget page posts to the page framing it; `public/embed.js` listens for it. */
export const EMBED_HEIGHT_MESSAGE = "openresto:embed-height";

/**
 * Tells the embedding page how tall the widget's content is, so `embed.js` can size the iframe
 * to it instead of showing a scrollbar. Only the height is sent, which is why any parent may
 * receive it. A no-op when the page is not framed (the plain link variant opens it in a tab).
 *
 * @see [embedHeight.test.ts](../tests/utils/embedHeight.test.ts): pins the message shape and
 * that an unframed page posts nothing.
 */
export function reportEmbedHeight(height: number): void {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, height: Math.ceil(height) }, "*");
}
