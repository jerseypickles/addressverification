export default async function handler(req, res) {
  const { createRequestHandler } = await import("@react-router/node");
  const build = await import("../build/server/index.js");

  const requestHandler = createRequestHandler(build, process.env.NODE_ENV);
  return requestHandler(req, res);
}
