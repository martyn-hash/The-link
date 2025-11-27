import type { Express } from "express";
import { registerClientPeopleRoutes } from "./people";
import { registerClientServicesRoutes } from "./services";
import { registerClientDocumentRoutes } from "./documents";
import { registerCompaniesHouseRoutes } from "./companiesHouse";
import { registerPortalUserRoutes } from "./portalUsers";
import { registerRiskAssessmentRoutes } from "./riskAssessments";
import { registerWebhookRoutes } from "./webhooks";

export function registerAllClientRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
) {
  registerClientPeopleRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerClientServicesRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerClientDocumentRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerCompaniesHouseRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerPortalUserRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerRiskAssessmentRoutes(app, isAuthenticated, resolveEffectiveUser, requireAdmin, requireManager);
  registerWebhookRoutes(app, isAuthenticated, resolveEffectiveUser);
}

export {
  registerClientPeopleRoutes,
  registerClientServicesRoutes,
  registerClientDocumentRoutes,
  registerCompaniesHouseRoutes,
  registerPortalUserRoutes,
  registerRiskAssessmentRoutes,
  registerWebhookRoutes,
};
