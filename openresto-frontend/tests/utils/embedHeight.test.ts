/**
 * @jest-environment jsdom
 */
import { EMBED_HEIGHT_MESSAGE, reportEmbedHeight } from "@/utils/embedHeight";

describe("reportEmbedHeight", () => {
  const originalParent = window.parent;
  afterEach(() =>
    Object.defineProperty(window, "parent", { value: originalParent, configurable: true })
  );

  it("posts the rounded-up content height to the framing page", () => {
    const postMessage = jest.fn();
    Object.defineProperty(window, "parent", { value: { postMessage }, configurable: true });

    reportEmbedHeight(611.2);

    expect(postMessage).toHaveBeenCalledWith({ type: EMBED_HEIGHT_MESSAGE, height: 612 }, "*");
  });

  it("posts nothing when the page is not framed", () => {
    const postMessage = jest.spyOn(window, "postMessage");

    reportEmbedHeight(600);

    expect(postMessage).not.toHaveBeenCalled();
  });
});
