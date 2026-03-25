export default async function handler(req, res) {
  try {
    const { createRequestListener } = await import("@react-router/node");
    const build = await import("../build/server/index.js");

    const listener = createRequestListener(build);
    return listener(req, res);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
