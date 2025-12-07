import type { Express } from "express";
import { storage } from "../storage/index";

export function registerSearchRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.get("/api/search", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { q: query, limit } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query 'q' is required" });
      }

      const searchLimit = limit ? parseInt(limit as string, 10) : 5;
      if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 20) {
        return res.status(400).json({ message: "Limit must be between 1 and 20" });
      }

      const results = await storage.superSearch(query.trim(), searchLimit);
      res.json(results);
    } catch (error) {
      console.error("Error performing super search:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });
}
