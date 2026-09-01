import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const patterns = (file: string) =>
  readFileSync(join(root, file), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

/**
 * EAS reads .easignore *instead of* .gitignore when it exists, so anything gitignored but
 * missing here would be uploaded to the build — and the reverse is what the file is for.
 */
describe(".easignore mirrors .gitignore", () => {
  const gitignore = patterns(".gitignore");
  const easignore = patterns(".easignore");

  it("ignores everything .gitignore ignores, except the generated native/ directory", () => {
    const expected = gitignore.filter((p) => p !== "/native/");
    expect(easignore).toEqual(expect.arrayContaining(expected));
  });

  it("lets native/ through to the build", () => {
    expect(gitignore).toContain("/native/");
    expect(easignore).not.toContain("/native/");
    expect(easignore).not.toContain("native/");
  });
});
