import { db } from "../../db";
import { eq, desc, and, not, inArray } from "drizzle-orm";
import {
  projectTypeNotifications,
  clientServices,
  clients,
  projects,
  clientPeople,
  people,
  projectTypes,
  type ProjectTypeNotification,
  type InsertProjectTypeNotification,
  type UpdateProjectTypeNotification,
  type Project,
  type PreviewCandidatesResponse,
  type PreviewCandidate,
  type PreviewCandidateRecipient,
} from "@shared/schema";

type GetServiceByProjectTypeIdFn = (projectTypeId: string) => Promise<{ id: string; name: string } | undefined>;
type GetStageByIdFn = (stageId: string) => Promise<{ name: string } | undefined>;

export class ProjectTypeNotificationStorage {
  private getServiceByProjectTypeId: GetServiceByProjectTypeIdFn;
  private getStageById: GetStageByIdFn;

  constructor(helpers: {
    getServiceByProjectTypeId: GetServiceByProjectTypeIdFn;
    getStageById: GetStageByIdFn;
  }) {
    this.getServiceByProjectTypeId = helpers.getServiceByProjectTypeId;
    this.getStageById = helpers.getStageById;
  }

  async getProjectTypeNotificationsByProjectTypeId(projectTypeId: string): Promise<ProjectTypeNotification[]> {
    return await db
      .select()
      .from(projectTypeNotifications)
      .where(eq(projectTypeNotifications.projectTypeId, projectTypeId))
      .orderBy(desc(projectTypeNotifications.createdAt));
  }

  async getProjectTypeNotificationById(id: string): Promise<ProjectTypeNotification | undefined> {
    const [notification] = await db
      .select()
      .from(projectTypeNotifications)
      .where(eq(projectTypeNotifications.id, id));
    return notification;
  }

  async createProjectTypeNotification(notification: InsertProjectTypeNotification): Promise<ProjectTypeNotification> {
    const [created] = await db
      .insert(projectTypeNotifications)
      .values(notification)
      .returning();
    return created;
  }

  async updateProjectTypeNotification(id: string, notification: UpdateProjectTypeNotification): Promise<ProjectTypeNotification> {
    const [updated] = await db
      .update(projectTypeNotifications)
      .set(notification)
      .where(eq(projectTypeNotifications.id, id))
      .returning();
    return updated;
  }

  async deleteProjectTypeNotification(id: string): Promise<void> {
    await db.delete(projectTypeNotifications).where(eq(projectTypeNotifications.id, id));
  }

  private isValidE164PhoneNumber(phoneNumber: string | null | undefined): boolean {
    if (!phoneNumber) return false;
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  async getPreviewCandidates(projectTypeId: string, notification: ProjectTypeNotification): Promise<PreviewCandidatesResponse> {
    console.log(`[PreviewCandidates] Starting preview candidate search for project type ${projectTypeId}, notification type: ${notification.notificationType}`);
    
    const service = await this.getServiceByProjectTypeId(projectTypeId);
    if (!service) {
      console.log(`[PreviewCandidates] No service mapped to project type ${projectTypeId}`);
      return {
        candidates: [],
        hasEligibleCandidates: false,
        message: "No service mapped to this project type. Preview is not available."
      };
    }
    console.log(`[PreviewCandidates] Found service: ${service.name} (${service.id})`);

    const allClientServices = await db
      .select({
        clientService: clientServices,
        client: clients
      })
      .from(clientServices)
      .innerJoin(clients, eq(clientServices.clientId, clients.id))
      .where(
        and(
          eq(clientServices.serviceId, service.id),
          eq(clientServices.isActive, true),
          not(eq(clientServices.frequency, 'one_time_only'))
        )
      );

    console.log(`[PreviewCandidates] Found ${allClientServices.length} active client service(s)`);
    if (allClientServices.length === 0) {
      return {
        candidates: [],
        hasEligibleCandidates: false,
        message: "No active client services found for this project type. Preview is not available."
      };
    }

    const clientIds = allClientServices.map(cs => cs.clientService.clientId);
    
    const projectConditions = [
      inArray(projects.clientId, clientIds),
      eq(projects.projectTypeId, projectTypeId),
      eq(projects.archived, false),
      eq(projects.inactive, false)
    ];

    if (notification.category === 'stage' && notification.stageId) {
      const stage = await this.getStageById(notification.stageId);
      if (!stage) {
        return {
          candidates: [],
          hasEligibleCandidates: false,
          message: "Stage not found. Preview is not available."
        };
      }
      projectConditions.push(eq(projects.currentStatus, stage.name));
    }

    const allProjects = await db
      .select()
      .from(projects)
      .where(and(...projectConditions));

    console.log(`[PreviewCandidates] Found ${allProjects.length} active project(s) for this project type`);
    if (allProjects.length === 0) {
      const message = notification.category === 'stage' 
        ? "No active projects found in the specified stage. Preview is not available."
        : "No active projects found for this project type. Preview is not available.";
      console.log(`[PreviewCandidates] ${message}`);
      return {
        candidates: [],
        hasEligibleCandidates: false,
        message
      };
    }

    const allClientPeopleData = await db
      .select({
        clientPerson: clientPeople,
        person: people
      })
      .from(clientPeople)
      .innerJoin(people, eq(clientPeople.personId, people.id))
      .where(inArray(clientPeople.clientId, clientIds));
    
    console.log(`[PreviewCandidates] Found ${allClientPeopleData.length} people across all clients`);

    const clientProjectsMap = new Map<string, Project[]>();
    allProjects.forEach(project => {
      const existing = clientProjectsMap.get(project.clientId) || [];
      existing.push(project);
      clientProjectsMap.set(project.clientId, existing);
    });

    const clientPeopleMap = new Map<string, (typeof allClientPeopleData[0])[]>();
    allClientPeopleData.forEach(row => {
      const existing = clientPeopleMap.get(row.clientPerson.clientId) || [];
      existing.push(row);
      clientPeopleMap.set(row.clientPerson.clientId, existing);
    });

    const candidates: PreviewCandidate[] = [];

    for (const { clientService, client } of allClientServices) {
      const clientProjects = clientProjectsMap.get(client.id) || [];
      if (clientProjects.length === 0) continue;

      const relatedPeople = clientPeopleMap.get(client.id) || [];
      
      for (const project of clientProjects) {
        const recipients: PreviewCandidateRecipient[] = relatedPeople.map(({ person }) => {
          let canPreview = true;
          let ineligibleReason: string | undefined;

          if (!person.receiveNotifications) {
            canPreview = false;
            ineligibleReason = "Notifications disabled for this contact";
          }
          else if (notification.notificationType === 'email' && !person.primaryEmail) {
            canPreview = false;
            ineligibleReason = "No email address on file";
          }
          else if (notification.notificationType === 'sms') {
            if (!person.primaryPhone) {
              canPreview = false;
              ineligibleReason = "No mobile number on file";
            } else if (!this.isValidE164PhoneNumber(person.primaryPhone)) {
              canPreview = false;
              ineligibleReason = `Phone number must be in E.164 format (e.g., +447441392660). Current format: ${person.primaryPhone}`;
            }
          }

          return {
            personId: person.id,
            fullName: person.fullName,
            email: person.primaryEmail,
            canPreview,
            ineligibleReason
          };
        });

        if (recipients.length > 0) {
          let stageName: string | null = null;
          if (project.currentStatus) {
            stageName = project.currentStatus;
          }

          candidates.push({
            clientId: client.id,
            clientName: client.name,
            projectId: project.id,
            projectName: (project as any).name || project.description,
            projectDescription: project.description,
            stageId: notification.stageId,
            stageName,
            dueDate: project.dueDate,
            clientServiceId: clientService.id,
            clientServiceName: service.name,
            frequency: clientService.frequency,
            recipients
          });
        }
      }
    }

    const hasEligibleCandidates = candidates.some(c => 
      c.recipients.some(r => r.canPreview)
    );

    return {
      candidates,
      hasEligibleCandidates,
      message: !hasEligibleCandidates 
        ? "Clients found but no eligible contacts. Contacts need notifications enabled and appropriate contact details (email/mobile)."
        : undefined
    };
  }
}
