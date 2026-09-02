import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const SEARCHED = ["app", "components"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * The attribute list of every `<Modal` element in a file: everything from the tag name to the
 * `>` that ends the opening tag, skipping any `>` nested inside a `{...}` prop value.
 */
function modalOpeningTags(source: string): string[] {
  const tags: string[] = [];
  const pattern = /<Modal[\s/>]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    let depth = 0;
    for (let i = match.index; i < source.length; i++) {
      const char = source[i];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0) {
        tags.push(source.slice(match.index, i));
        break;
      }
    }
  }
  return tags;
}

/**
 * Android's predictive back gesture (#430) reaches an overlay through `Modal.onRequestClose`.
 * A `Modal` without one does not merely ignore the gesture: the press falls through to the
 * activity and the app closes with the overlay still on screen, which is the worst outcome of
 * the three. The rule is structural rather than a list, so a Modal added tomorrow is covered
 * the day it ships — same reasoning as the backend's audit-coverage test.
 *
 * Nothing in the app hand-rolls `BackHandler`; if something starts to, this test will not see
 * it, and the flag in `app.config.ts` would need re-checking on a device.
 */
describe("every overlay can be dismissed by the Android back gesture", () => {
  const files = SEARCHED.flatMap((dir) => sourceFiles(join(root, dir)));

  it("finds the Modals it is meant to be checking", () => {
    const withModals = files.filter((f) => modalOpeningTags(readFileSync(f, "utf8")).length > 0);
    // A parser change that quietly matched nothing would make every assertion below vacuous.
    expect(withModals.length).toBeGreaterThan(5);
  });

  it("gives each one an onRequestClose", () => {
    const missing = files.flatMap((file) =>
      modalOpeningTags(readFileSync(file, "utf8"))
        .filter((tag) => !tag.includes("onRequestClose"))
        .map(() => file.slice(root.length + 1))
    );

    expect(missing).toEqual([]);
  });
});
