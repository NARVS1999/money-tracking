module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@firebase/auth$": "<rootDir>/node_modules/@firebase/auth/dist/rn/index.js",
    "^@firebase/util$": "<rootDir>/node_modules/@firebase/util/dist/index.cjs.js",
    "^@firebase/logger$": "<rootDir>/node_modules/@firebase/logger/dist/index.cjs.js",
    "^@firebase/component$": "<rootDir>/node_modules/@firebase/component/dist/index.cjs.js",
    "^@firebase/app$": "<rootDir>/node_modules/@firebase/app/dist/index.cjs.js",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock",
    // Official jest mock shipped by the package (its native module is not
    // linked under jest — without this, importing the app graph throws a
    // LINKING_ERROR at module load).
    "^react-native-keyboard-controller$":
      "<rootDir>/node_modules/react-native-keyboard-controller/jest/index.js",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|firebase|@firebase/.*))",
  ],
};
