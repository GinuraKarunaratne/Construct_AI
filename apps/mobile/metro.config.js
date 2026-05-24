const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * Force Metro to run Babel on these node_modules packages.
 * By default Metro skips node_modules for speed, but some modern packages
 * use private class fields (#field) or other syntax Hermes can't execute raw.
 *
 * Pattern: transform everything EXCEPT the listed packages.
 * (i.e. the listed packages ARE transformed — everything else is skipped)
 */
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!(" + [
    "react-native",
    "@react-native",
    "@react-native-async-storage",
    "expo",
    "expo-.*",
    "@expo",
    "@expo/.*",
    "@unimodules",
    "@react-navigation",
    "@react-navigation/.*",
    "@tanstack",
    "@tanstack/.*",
    "react-native-screens",
    "react-native-safe-area-context",
  ].join("|") + "))",
];

module.exports = config;
