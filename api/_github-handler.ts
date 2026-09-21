/*
 * Node adapter for the GitHub router.
 *
 * Vercel ignores files in `api/` whose name starts with an underscore, so this
 * stays a shared helper rather than becoming its own endpoint. It is typed
 * against Node's own http types — VercelRequest/VercelResponse extend them —
 * which keeps the integration free of a deployment-platform dependency.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

/*
 * The `.js` extension below is required, not stylistic: Vercel's builder
 * transpiles each TypeScript file independently rather than bundling them into
 * one output file, and the compiled `.js` runs under Node's native ESM loader
 * (package.json has `"type": "module"`). That loader — unlike bundlers such as
 * Vite/esbuild, and unlike CommonJS `require` — refuses to resolve an
 * extensionless relative specifier, so `"../server/github/router"` throws
 * `ERR_MODULE_NOT_FOUND` at import time in production while working fine in
 * local dev (where Vite bundles everything). TypeScript's "bundler" module
 * resolution (see tsconfig.server.json) accepts a `.js` specifier that points
 * at a `.ts` source file, so this checks out at compile time too.
 */
import { handleGitHubRequest, type GitHubRoute } from "../server/github/router.js";

export function createGitHubHandler(route: GitHubRoute) {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({ error: { code: "invalid_request", message: "Method not allowed." } }),
      );
      return;
    }

    const params = new URL(req.url ?? "", "http://localhost").searchParams;
    const result = await handleGitHubRequest(route, params);

    res.statusCode = result.status;
    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(result.body));
  };
}
