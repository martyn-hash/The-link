import type { Express } from "express";
import { storage } from "../../storage/index";

export function registerProjectAssigneesRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any,
  requireManager: any
): void {
  app.get("/api/projects/:projectId/assignees", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const effectiveUser = req.user?.effectiveUser;
      const effectiveUserId = req.user?.effectiveUserId;
      
      if (!effectiveUser || !effectiveUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: "Valid project ID is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const canView =
        effectiveUser.isAdmin ||
        project.currentAssigneeId === effectiveUserId ||
        project.clientManagerId === effectiveUserId ||
        project.bookkeeperId === effectiveUserId;

      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this project's assignees" });
      }

      const assigneeMap = new Map<string, { id: string; projectId: string; userId: string; roleId: string | null; user: any; role: { id: string; name: string } | null }>();

      if (project.currentAssigneeId && project.currentAssignee) {
        const { passwordHash, ...sanitizedUser } = project.currentAssignee;
        assigneeMap.set(project.currentAssigneeId, {
          id: `${projectId}-current-${project.currentAssigneeId}`,
          projectId,
          userId: project.currentAssigneeId,
          roleId: null,
          user: sanitizedUser,
          role: { id: 'current_assignee', name: 'Current Assignee' },
        });
      }

      if (project.clientManagerId && project.clientManager && !assigneeMap.has(project.clientManagerId)) {
        const { passwordHash, ...sanitizedUser } = project.clientManager;
        assigneeMap.set(project.clientManagerId, {
          id: `${projectId}-manager-${project.clientManagerId}`,
          projectId,
          userId: project.clientManagerId,
          roleId: null,
          user: sanitizedUser,
          role: { id: 'client_manager', name: 'Client Manager' },
        });
      }

      if (project.bookkeeperId && project.bookkeeper && !assigneeMap.has(project.bookkeeperId)) {
        const { passwordHash, ...sanitizedUser } = project.bookkeeper;
        assigneeMap.set(project.bookkeeperId, {
          id: `${projectId}-bookkeeper-${project.bookkeeperId}`,
          projectId,
          userId: project.bookkeeperId,
          roleId: null,
          user: sanitizedUser,
          role: { id: 'bookkeeper', name: 'Bookkeeper' },
        });
      }

      res.json(Array.from(assigneeMap.values()));
    } catch (error) {
      console.error("Error fetching project assignees:", error);
      res.status(500).json({ message: "Failed to fetch project assignees" });
    }
  });

  app.get("/api/projects/:projectId/role-assignee", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;
      const { stageName } = req.query;

      console.log(`[role-assignee] Request for project ${projectId}, stageName: ${stageName || 'current'}`);

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: "Valid project ID is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const stages = await storage.getKanbanStagesByProjectTypeId(project.projectTypeId);
      const targetStageName = stageName || project.currentStatus;
      const currentStage = stages.find(stage => stage.name === targetStageName);

      console.log(`[role-assignee] Target stage: ${targetStageName}, found stage: ${currentStage ? 'yes' : 'no'}, assigned role ID: ${currentStage?.assignedWorkRoleId || 'none'}`);

      if (!currentStage || !currentStage.assignedWorkRoleId) {
        const assignee = project.currentAssignee || project.clientManager;
        if (assignee) {
          const { passwordHash, ...sanitizedUser } = assignee;
          return res.json({
            user: sanitizedUser,
            roleUsed: null,
            usedFallback: false,
            source: 'direct_assignment'
          });
        } else {
          const fallbackUser = await storage.getFallbackUser();
          if (fallbackUser) {
            const { passwordHash, ...sanitizedUser } = fallbackUser;
            return res.json({
              user: sanitizedUser,
              roleUsed: null,
              usedFallback: true,
              source: 'fallback_user'
            });
          } else {
            return res.json({
              user: null,
              roleUsed: null,
              usedFallback: false,
              source: 'none'
            });
          }
        }
      }

      let resolvedUser = await storage.resolveRoleAssigneeForClientByRoleId(
        project.clientId,
        project.projectTypeId,
        currentStage.assignedWorkRoleId
      );

      console.log(`[role-assignee] Resolved user for role ID ${currentStage.assignedWorkRoleId}: ${resolvedUser ? `${resolvedUser.firstName} ${resolvedUser.lastName}` : 'none'}`);

      let usedFallback = false;
      let source = 'role_assignment';

      if (!resolvedUser) {
        resolvedUser = await storage.getFallbackUser();
        usedFallback = true;
        source = 'fallback_user';

        if (!resolvedUser) {
          return res.json({
            user: null,
            roleUsed: currentStage.assignedWorkRoleId,
            usedFallback: false,
            source: 'none'
          });
        }
      }

      const { passwordHash, ...sanitizedUser } = resolvedUser;

      res.json({
        user: sanitizedUser,
        roleUsed: currentStage.assignedWorkRoleId,
        usedFallback,
        source
      });
    } catch (error) {
      console.error("Error resolving project role assignee:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to resolve project role assignee" });
    }
  });

  app.get("/api/projects/:projectId/service-roles", isAuthenticated, resolveEffectiveUser, async (req: any, res: any) => {
    try {
      const { projectId } = req.params;

      if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ message: "Valid project ID is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.projectTypeId) {
        return res.json({ roles: [] });
      }

      const clientService = await storage.getClientServiceByClientAndProjectType(
        project.clientId,
        project.projectTypeId
      );

      if (!clientService) {
        return res.json({ roles: [] });
      }

      const roleAssignments = await storage.getActiveClientServiceRoleAssignments(clientService.id);

      const roles = roleAssignments.map(assignment => ({
        roleName: assignment.workRole.name,
        user: assignment.user ? {
          id: assignment.user.id,
          email: assignment.user.email,
          firstName: assignment.user.firstName,
          lastName: assignment.user.lastName,
          isAdmin: assignment.user.isAdmin,
          canSeeAdminMenu: assignment.user.canSeeAdminMenu
        } : null
      }));

      res.json({ roles });
    } catch (error) {
      console.error("Error resolving project service roles:", error instanceof Error ? error.message : error);
      res.status(500).json({ message: "Failed to resolve project service roles" });
    }
  });
}
