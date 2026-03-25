import pkg from "@react-router/node";
const { createRequestHandler } = pkg;

const handler = createRequestHandler(
  await import("../build/server/index.js"),
  process.env.NODE_ENV
);

export default handler;
