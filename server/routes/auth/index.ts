import type { Express } from "express";
import { registerAuthCoreRoutes } from "./core";
import { registerAuthBootstrapRoutes } from "./bootstrap";

export function registerAuthRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  registerAuthBootstrapRoutes(app);
  registerAuthCoreRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin);
}
