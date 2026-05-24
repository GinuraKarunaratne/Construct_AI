module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Compile private class fields (#field) and private methods (#method())
      // down to normal JS so Hermes in Expo Go can execute them.
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
    ],
  };
};
