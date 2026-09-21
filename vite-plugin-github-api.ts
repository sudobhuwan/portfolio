/*
 * Serves /api/github/* from the Vite dev server so `npm run dev` behaves like
 * production, where the same routes are Vercel serverless functions.
 *
 * GITHUB_TOKEN is read here, inside the Node process. It is loaded with an
 * empty `loadEnv` prefix (which reads every variable, not just VITE_*) and
 * assigned to process.env only — it is never passed to `define`, so it cannot
 * reach the client bundle.
 *
 * The router is imported statically: Vite bundles the config and its imports,
 * and restarts the dev server when any of them change.
 */

import type { Connect, Plugin } from "vite";
import { loadEnv } from "vite";

import { handleGitHubRequest, isGitHubRoute } from "./server/github/router";

const API_PREFIX = "/api/github/";
const SERVER_ONLY_VARS = ["GITHUB_USERNAME", "GITHUB_TOKEN"] as const;

function sendJson(
  res: Parameters<Connect.NextHandleFunction>[1],
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // A dev server is not a CDN; don't let the browser hold onto responses.
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

const middleware: Connect.NextHandleFunction = (req, res, next) => {
  const url = new URL(req.url ?? "", "http://localhost");
  if (!url.pathname.startsWith(API_PREFIX)) {
    next();
    return;
  }

  const route = url.pathname.slice(API_PREFIX.length).replace(/\/$/, "");
  if (!isGitHubRoute(route)) {
    sendJson(res, 404, { error: { code: "invalid_request", message: "Unknown route." } });
    return;
  }

  handleGitHubRequest(route, url.searchParams)
    .then((result) => sendJson(res, result.status, result.body, result.headers))
    .catch((error: unknown) => {
      console.error("[github] dev middleware failure", error);
      sendJson(res, 500, {
        error: { code: "upstream_error", message: "GitHub activity is temporarily unavailable." },
      });
    });
};

export function githubApiPlugin(): Plugin {
  return {
    name: "portfolio:github-api",
    // `apply` is omitted on purpose so this also serves `vite preview`.
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || process.cwd(), "");
      for (const key of SERVER_ONLY_VARS) {
        // A real shell export wins over the .env file.
        if (!process.env[key] && env[key]) process.env[key] = env[key];
      }
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
