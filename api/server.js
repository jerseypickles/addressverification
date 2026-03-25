export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  try {
    const mod = await import("@react-router/node");
    const createRequestHandler = mod.createRequestHandler || mod.default?.createRequestHandler;
    const build = await import("../build/server/index.js");

    const handler = createRequestHandler(build.default || build);

    // Convert Vercel req to Web Request
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = new URL(req.url, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const body = req.method !== "GET" && req.method !== "HEAD" ? req : undefined;

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
      duplex: body ? "half" : undefined,
    });

    const webResponse = await handler(webRequest);

    res.status(webResponse.status);
    for (const [key, value] of webResponse.headers.entries()) {
      res.setHeader(key, value);
    }

    if (webResponse.body) {
      const reader = webResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
