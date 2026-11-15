const { TestEnvironment } = require("jest-environment-jsdom");

/**
 * jsdom with the three things React Native 0.88's Jest preset needs from it under Jest 30:
 *
 * - The preset's setup redefines `window`, which jsdom 26 makes non-configurable
 *   (react-native#59475, closed as not planned). Under jsdom `window` already is the global,
 *   the value the setup assigns, so that one property is dropped from the call.
 * - Teardown clears mocks by reading every enumerable global, which evaluates Expo's lazy globals
 *   after the test and fails ("require a file outside of the scope of the test code").
 *   Accessors are skipped, as jest-expo's own `src/preset/nativeEnvironment.js` does.
 * - Animated calls `clearImmediate`, which jsdom does not provide.
 */
class JsdomEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    const global = this.global;
    global.clearImmediate ??= clearImmediate;

    const defineProperties = global.Object.defineProperties;
    global.Object.defineProperties = function (target, props) {
      if (
        target === global &&
        "window" in props &&
        !global.Object.getOwnPropertyDescriptor(global, "window")?.configurable
      ) {
        const { window: _window, ...rest } = props;
        return defineProperties(target, rest);
      }
      return defineProperties(target, props);
    };

    const mocker = this.moduleMocker;
    mocker.clearMocksOnScope = function (scope) {
      for (const key of Object.keys(scope)) {
        const descriptor = Object.getOwnPropertyDescriptor(scope, key);
        if (!descriptor || typeof descriptor.get === "function") continue;
        const value = descriptor.value;
        if (
          value != null &&
          (typeof value === "object" || typeof value === "function") &&
          mocker.isMockFunction(value)
        ) {
          value.mockClear();
        }
      }
    };
  }
}

module.exports = JsdomEnvironment;
