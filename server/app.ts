import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";
import { auth, getConfiguredAuthOptions } from "./auth";
import { getMissingProductionConfig } from "./_core/config";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  // Normalize req.url for Vercel serverless functions where /api prefix may be rewritten
  app.use((req, _res, next) => {
    if (!req.url.startsWith("/api") && !req.url.startsWith("/manus-storage")) {
      const path = req.url.startsWith("/") ? req.url : `/${req.url}`;
      req.url = `/api${path}`;
    }
    next();
  });

  // Production safety gate: refuse to serve anything unless the database and auth
  // secrets are configured. Reports variable NAMES only, never values.
  app.use((req, res, next) => {
    const missing = getMissingProductionConfig();
    if (missing.length === 0) return next();
    console.error("[Config] Missing production configuration:", missing.join(", "));
    res.status(503).json({ status: "misconfigured", missing });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/auth/configured-options", (_req, res) => {
    res.json(getConfiguredAuthOptions());
  });

  // BetterAuth route handler (mounted before global JSON body parsing)
  app.all("/api/auth/*", toNodeHandler(auth.handler));

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
