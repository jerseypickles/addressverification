const { createRequestHandler } = await import("@react-router/node");
const build = await import("../build/server/index.js");

const handler = createRequestHandler(build, process.env.NODE_ENV);

export default handler;
