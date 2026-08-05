/** @type {import('react-native-unistyles/plugin').UnistylesPluginOptions} */
const unistylesPluginOptions = {
  // Routes live in `app/`; shared UI lives in `components/`, which sits outside
  // `root`, so `autoProcessImports` opts those files in by their import instead.
  root: "app",
  autoProcessImports: ["react-native-unistyles"],
  // expo-router's <Link> renders its own react-native <Text>, so it has to be
  // opted in explicitly or Unistyles styles handed to it are silently dropped.
  autoProcessPaths: ["expo-router/build/link"],
};

module.exports = function (api) {
  api.cache(true);

  return {
    // babel-preset-expo already wires react-compiler and the worklets plugin;
    // this file exists only so the Unistyles plugin can be added.
    presets: ["babel-preset-expo"],
    plugins: [["react-native-unistyles/plugin", unistylesPluginOptions]],
  };
};
