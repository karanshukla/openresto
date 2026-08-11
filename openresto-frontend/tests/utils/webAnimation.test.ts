/**
 * @jest-environment jsdom
 */
import { animateNode, prefersReducedMotion } from "@/utils/webAnimation";

const keyframes = [{ opacity: 0 }, { opacity: 1 }];
const options = { duration: 100 };

function setReducedMotion(reduced: boolean) {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: reduced }) as unknown as typeof matchMedia;
}

describe("animateNode", () => {
  beforeEach(() => setReducedMotion(false));

  it("runs the keyframes on a node that can animate", () => {
    const running = {};
    const node = { animate: jest.fn(() => running) };

    expect(animateNode(node, keyframes, options)).toBe(running);
    expect(node.animate).toHaveBeenCalledWith(keyframes, options);
  });

  it("does nothing without a DOM node", () => {
    // A View ref is a native component instance off the web, with no animate() on it.
    expect(animateNode({ measureLayout: jest.fn() }, keyframes, options)).toBeNull();
    expect(animateNode(null, keyframes, options)).toBeNull();
  });

  it("does nothing when the visitor asked for reduced motion", () => {
    setReducedMotion(true);
    const node = { animate: jest.fn() };

    expect(animateNode(node, keyframes, options)).toBeNull();
    expect(node.animate).not.toHaveBeenCalled();
  });
});

describe("prefersReducedMotion", () => {
  it("reports the media query", () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("assumes full motion where matchMedia is unavailable", () => {
    // @ts-expect-error - deleting the API is the point of the test
    delete window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
  });
});
