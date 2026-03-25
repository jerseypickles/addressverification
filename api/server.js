let listener;

export default async function handler(req, res) {
  try {
    if (!listener) {
      const { createRequestListener } = await import("@react-router/node");
      const mod = await import("../build/server/index.js");

      // The module has routes, entry, etc. at top level
      // createRequestListener expects { routes, entry, assets, ... }
      const build = {
        routes: mod.routes,
        entry: mod.entry,
        assets: mod.assets,
        assetsBuildDirectory: mod.assetsBuildDirectory,
        basename: mod.basename,
        future: mod.future,
        isSpaMode: mod.isSpaMode,
        publicPath: mod.publicPath,
        ssr: mod.ssr,
        prerender: mod.prerender,
        routeDiscovery: mod.routeDiscovery,
      };

      listener = createRequestListener(build);
    }
    return listener(req, res);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
