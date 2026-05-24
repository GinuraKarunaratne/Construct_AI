const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Force Metro to Babel-transform packages that use private class fields (#field syntax)
// Hermes in Expo Go does not support native private fields — they must be compiled down.
// Packages that need this: @tanstack/react-query v5, axios, etc.
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!(" +
    "@react-native|" +
    "react-native|" +
    "expo|" +
    "expo-.*|" +
    "@expo|" +
    "@expo/.*|" +
    "@unimodules|" +
    "@react-navigation|" +
    "@tanstack/.*|" +
    "axios" +
  "))",
];

module.exports = config;
