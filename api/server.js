import { createRequestHandler } from "@react-router/node";

const handler = createRequestHandler(
  await import("../build/server/index.js"),
  process.env.NODE_ENV
);

export default handler;
