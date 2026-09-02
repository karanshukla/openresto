const basePreset = require("jest-expo/jest-preset");
const pkg = require("./package.json");

/**
 * The Android half of the suite. `package.json`'s own jest block is the iOS half: jest-expo's
 * default preset sets `haste.defaultPlatform: "ios"`, so every run there resolves `.ios.*` and
 * reports `Platform.OS === "ios"`. That is the whole reason this file exists — without it the
 * Android branch of every `Platform.OS` check, and every `.android.*` module, is never executed.
 *
 * Everything but the platform is inherited from `pkg.jest`, so the two halves cannot drift.
 *
 * The transform is rebuilt rather than left to the preset: `jest-expo/android/jest-preset`
 * sets only `caller.platform` and drops the `presets: [expo/internal/babel-preset]` that the
 * default preset injects. Projects with their own `babel.config.js` do not notice, because
 * `babelrc`/`configFile` resolution picks the preset up anyway; this repo has no babel config,
 * so without carrying the base transform over, Babel parses React Native's flow-typed sources
 * with no preset at all and every suite dies in `@react-native/jest-preset/jest/setup.js`.
 */
const SOURCE_TRANSFORM = "\\.[jt]sx?$";
const [runner, options] = basePreset.transform[SOURCE_TRANSFORM];

module.exports = {
  ...pkg.jest,
  rootDir: __dirname,
  preset: "jest-expo/android",
  displayName: "android",
  transform: {
    ...pkg.jest.transform,
    [SOURCE_TRANSFORM]: [
      runner,
      { ...options, caller: { ...options.caller, platform: "android" } },
    ],
  },
};
