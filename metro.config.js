// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-svg v15.15.4's "react-native" field points to src/index.ts
// which imports Node built-ins (buffer) that don't exist in React Native.
// Force Metro to use the pre-built CommonJS files instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-svg") {
    return {
      filePath: require.resolve("react-native-svg/lib/commonjs/index.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
