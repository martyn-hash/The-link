import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../storage/index";

const VALID_FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually'];

export function registerAdminMiscRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  app.post("/api/admin/delete-test-data", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        console.warn(`Blocked delete-test-data attempt in production by user ${req.user?.effectiveUserId || req.user?.id}`);
        return res.status(403).json({
          message: "Delete test data is not available in production environment"
        });
      }

      const bodySchema = z.object({
        confirm: z.string().min(1, "Confirmation is required")
      });

      const bodyValidation = bodySchema.safeParse(req.body);
      if (!bodyValidation.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: bodyValidation.error.issues
        });
      }

      const { confirm } = bodyValidation.data;

      if (confirm !== "DELETE") {
        return res.status(400).json({
          message: "Confirmation string must be exactly 'DELETE'"
        });
      }

      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      console.log(`Deleting test data requested by user ${effectiveUserId}`);

      res.json({
        message: "Test data deletion initiated",
        requestedBy: effectiveUserId
      });
    } catch (error) {
      console.error("Error deleting test data:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to delete test data" });
    }
  });

  app.get("/api/admin/frequency-issues", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const allClientServices = await storage.getAllClientServicesWithDetails();
      const allPeopleServices = await storage.getAllPeopleServicesWithDetails();
      const allClients = await storage.getAllClients();
      const allPeople = await storage.getAllPeople();

      const clientMap = new Map(allClients.map((c: any) => [c.id, c.name]));
      const personMap = new Map(allPeople.map((p: any) => [p.id, p.fullName]));

      const clientIssues = allClientServices
        .filter((cs: any) => cs.frequency && !VALID_FREQUENCIES.includes(cs.frequency))
        .map((cs: any) => ({
          id: cs.id,
          type: 'client_service' as const,
          clientName: clientMap.get(cs.clientId) || 'Unknown Client',
          serviceName: cs.service?.name || 'Unknown Service',
          currentFrequency: cs.frequency,
          suggestedFrequency: cs.frequency?.toLowerCase(),
          canAutoFix: VALID_FREQUENCIES.includes(cs.frequency?.toLowerCase())
        }));

      const peopleIssues = allPeopleServices
        .filter((ps: any) => ps.frequency && !VALID_FREQUENCIES.includes(ps.frequency))
        .map((ps: any) => ({
          id: ps.id,
          type: 'people_service' as const,
          personName: personMap.get(ps.personId) || 'Unknown Person',
          serviceName: ps.service?.name || 'Unknown Service',
          currentFrequency: ps.frequency,
          suggestedFrequency: ps.frequency?.toLowerCase(),
          canAutoFix: VALID_FREQUENCIES.includes(ps.frequency?.toLowerCase())
        }));

      res.json({
        clientServiceIssues: clientIssues,
        peopleServiceIssues: peopleIssues,
        totalIssues: clientIssues.length + peopleIssues.length,
        autoFixableIssues: [...clientIssues, ...peopleIssues].filter(i => i.canAutoFix).length,
        validFrequencies: VALID_FREQUENCIES
      });
    } catch (error) {
      console.error("Error fetching frequency issues:", error);
      res.status(500).json({ message: "Failed to fetch frequency issues" });
    }
  });

  app.post("/api/admin/fix-frequencies", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;
      console.log(`Fixing frequency issues requested by user ${effectiveUserId}`);

      const allClientServices = await storage.getAllClientServicesWithDetails();
      const allPeopleServices = await storage.getAllPeopleServicesWithDetails();
      const allClients = await storage.getAllClients();
      const allPeople = await storage.getAllPeople();

      const clientMap = new Map(allClients.map((c: any) => [c.id, c.name]));
      const personMap = new Map(allPeople.map((p: any) => [p.id, p.fullName]));

      const results = {
        clientServicesFixed: 0,
        peopleServicesFixed: 0,
        clientServicesSkipped: 0,
        peopleServicesSkipped: 0,
        details: [] as Array<{ type: string; id: string; name: string; from: string; to: string }>
      };

      for (const cs of allClientServices) {
        if (cs.frequency && !VALID_FREQUENCIES.includes(cs.frequency)) {
          const lowercaseFreq = cs.frequency.toLowerCase();
          if (VALID_FREQUENCIES.includes(lowercaseFreq)) {
            await storage.updateClientService(cs.id, { frequency: lowercaseFreq });
            results.clientServicesFixed++;
            results.details.push({
              type: 'client_service',
              id: cs.id,
              name: `${clientMap.get(cs.clientId) || 'Unknown'} / ${cs.service?.name || 'Unknown'}`,
              from: cs.frequency,
              to: lowercaseFreq
            });
          } else {
            results.clientServicesSkipped++;
          }
        }
      }

      for (const ps of allPeopleServices) {
        if (ps.frequency && !VALID_FREQUENCIES.includes(ps.frequency)) {
          const lowercaseFreq = ps.frequency.toLowerCase();
          if (VALID_FREQUENCIES.includes(lowercaseFreq)) {
            await storage.updatePeopleService(ps.id, { frequency: lowercaseFreq });
            results.peopleServicesFixed++;
            results.details.push({
              type: 'people_service',
              id: ps.id,
              name: `${personMap.get(ps.personId) || 'Unknown'} / ${ps.service?.name || 'Unknown'}`,
              from: ps.frequency,
              to: lowercaseFreq
            });
          } else {
            results.peopleServicesSkipped++;
          }
        }
      }

      console.log(`Frequency fix complete: ${results.clientServicesFixed} client services fixed, ${results.peopleServicesFixed} people services fixed`);

      res.json({
        success: true,
        message: `Fixed ${results.clientServicesFixed + results.peopleServicesFixed} services`,
        ...results
      });
    } catch (error) {
      console.error("Error fixing frequencies:", error);
      res.status(500).json({ message: "Failed to fix frequencies" });
    }
  });

  app.get("/api/admin/scheduling-exceptions", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { resolved, errorType, serviceType, limit } = req.query;
      
      const filters: any = {};
      if (resolved !== undefined) {
        filters.resolved = resolved === 'true';
      }
      if (errorType) {
        filters.errorType = errorType;
      }
      if (serviceType) {
        filters.serviceType = serviceType;
      }
      if (limit) {
        filters.limit = parseInt(limit);
      }

      const exceptions = await storage.getSchedulingExceptions(filters);
      
      res.json({
        exceptions,
        total: exceptions.length,
        unresolved: exceptions.filter(e => !e.resolved).length
      });
    } catch (error) {
      console.error("Error fetching scheduling exceptions:", error);
      res.status(500).json({ message: "Failed to fetch scheduling exceptions" });
    }
  });

  app.get("/api/admin/scheduling-exceptions/unresolved", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const exceptions = await storage.getUnresolvedSchedulingExceptions();
      
      const byErrorType = exceptions.reduce((acc, e) => {
        acc[e.errorType] = (acc[e.errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        exceptions,
        total: exceptions.length,
        byErrorType
      });
    } catch (error) {
      console.error("Error fetching unresolved scheduling exceptions:", error);
      res.status(500).json({ message: "Failed to fetch unresolved scheduling exceptions" });
    }
  });

  app.post("/api/admin/scheduling-exceptions/:id/resolve", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      const exception = await storage.resolveSchedulingException(id, effectiveUserId, notes);
      
      if (!exception) {
        return res.status(404).json({ message: "Exception not found" });
      }

      res.json({
        success: true,
        message: "Exception resolved",
        exception
      });
    } catch (error) {
      console.error("Error resolving scheduling exception:", error);
      res.status(500).json({ message: "Failed to resolve scheduling exception" });
    }
  });

  app.post("/api/admin/scheduling-exceptions/resolve-all", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { serviceId, serviceType, notes } = req.body;
      const effectiveUserId = req.user?.effectiveUserId || req.user?.id;

      if (!serviceId || !serviceType) {
        return res.status(400).json({ message: "serviceId and serviceType are required" });
      }

      const resolvedCount = await storage.resolveAllExceptionsForService(
        serviceId, 
        serviceType, 
        effectiveUserId, 
        notes
      );

      res.json({
        success: true,
        message: `Resolved ${resolvedCount} exceptions`,
        resolvedCount
      });
    } catch (error) {
      console.error("Error resolving scheduling exceptions:", error);
      res.status(500).json({ message: "Failed to resolve scheduling exceptions" });
    }
  });

  app.get("/api/admin/scheduling-exceptions/by-run/:runLogId", isAuthenticated, resolveEffectiveUser, requireAdmin, async (req: any, res: any) => {
    try {
      const { runLogId } = req.params;
      const exceptions = await storage.getSchedulingExceptionsByRunLog(runLogId);

      res.json({
        exceptions,
        total: exceptions.length,
        runLogId
      });
    } catch (error) {
      console.error("Error fetching scheduling exceptions by run:", error);
      res.status(500).json({ message: "Failed to fetch scheduling exceptions" });
    }
  });
}
