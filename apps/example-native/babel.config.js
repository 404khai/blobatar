/**
 * Present only for the worklets plugin.
 *
 * `AnimatedBlobatar` runs its loops on the UI thread, and a function reaches
 * that thread only if this plugin has rewritten it. The published adapter
 * compiles its own worklets, so a consumer does not strictly need this for
 * blobatar itself; this app, though, resolves `@blobatar/react-native` through
 * the workspace, and any worklet written here would need it.
 *
 * It must be last in the plugin list, which is what its own documentation says
 * and the one rule about it that is easy to break silently.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: ["react-native-worklets/plugin"],
  };
};
