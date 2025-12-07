import {
  TaskInstanceStorage,
  TaskInstanceResponseStorage,
  TaskTypeStorage,
  InternalTaskStorage,
  TaskTimeEntryStorage
} from '../tasks/index.js';

export interface TasksFacadeDeps {
  taskInstanceStorage: TaskInstanceStorage;
  taskInstanceResponseStorage: TaskInstanceResponseStorage;
  taskTypeStorage: TaskTypeStorage;
  internalTaskStorage: InternalTaskStorage;
  taskTimeEntryStorage: TaskTimeEntryStorage;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export function applyTasksFacade<TBase extends Constructor<TasksFacadeDeps>>(Base: TBase) {
  return class extends Base {
    // ============================================================================
    // TASK INSTANCE OPERATIONS - TaskInstanceStorage (12 methods)
    // ============================================================================

    async createTaskInstance(instance: any) {
      return this.taskInstanceStorage.createTaskInstance(instance);
    }

    async getTaskInstanceById(id: string) {
      return this.taskInstanceStorage.getTaskInstanceById(id);
    }

    async getTaskInstancesByProjectId(projectId: string) {
      return this.taskInstanceStorage.getTaskInstancesByProjectId(projectId);
    }

    async getTaskInstancesByClientId(clientId: string) {
      return this.taskInstanceStorage.getTaskInstancesByClientId(clientId);
    }

    async getTaskInstancesByClientPortalUserId(clientPortalUserId: string) {
      return this.taskInstanceStorage.getTaskInstancesByClientPortalUserId(clientPortalUserId);
    }

    async getTaskInstancesByPersonId(personId: string) {
      return this.taskInstanceStorage.getTaskInstancesByPersonId(personId);
    }

    async getTaskInstancesByPersonIdAndClientId(personId: string, clientId: string) {
      return this.taskInstanceStorage.getTaskInstancesByPersonIdAndClientId(personId, clientId);
    }

    async getTaskInstancesByStatus(status: string) {
      return this.taskInstanceStorage.getTaskInstancesByStatus(status);
    }

    async getAllTaskInstances(filters?: { status?: string; clientId?: string }) {
      return this.taskInstanceStorage.getAllTaskInstances(filters);
    }

    async updateTaskInstance(id: string, instance: any) {
      return this.taskInstanceStorage.updateTaskInstance(id, instance);
    }

    async deleteTaskInstance(id: string) {
      return this.taskInstanceStorage.deleteTaskInstance(id);
    }

    async getTaskInstanceWithFullData(id: string) {
      return this.taskInstanceStorage.getTaskInstanceWithFullData(id);
    }

    // ============================================================================
    // TASK INSTANCE RESPONSE OPERATIONS - TaskInstanceResponseStorage (8 methods)
    // ============================================================================

    async saveTaskInstanceResponse(response: any) {
      return this.taskInstanceResponseStorage.saveTaskInstanceResponse(response);
    }

    async createTaskInstanceResponse(response: any) {
      return this.taskInstanceResponseStorage.createTaskInstanceResponse(response);
    }

    async getTaskInstanceResponseById(id: string) {
      return this.taskInstanceResponseStorage.getTaskInstanceResponseById(id);
    }

    async getTaskInstanceResponsesByTaskInstanceId(taskInstanceId: string) {
      return this.taskInstanceResponseStorage.getTaskInstanceResponsesByTaskInstanceId(taskInstanceId);
    }

    async getTaskInstanceResponsesByInstanceId(instanceId: string) {
      return this.taskInstanceResponseStorage.getTaskInstanceResponsesByTaskInstanceId(instanceId);
    }

    async updateTaskInstanceResponse(id: string, response: any) {
      return this.taskInstanceResponseStorage.updateTaskInstanceResponse(id, response);
    }

    async deleteTaskInstanceResponse(id: string) {
      return this.taskInstanceResponseStorage.deleteTaskInstanceResponse(id);
    }

    async bulkSaveTaskInstanceResponses(taskInstanceId: string, responses: any[]) {
      return this.taskInstanceResponseStorage.bulkSaveTaskInstanceResponses(taskInstanceId, responses);
    }

    // ============================================================================
    // TASK TYPE OPERATIONS - TaskTypeStorage (6 methods)
    // ============================================================================

    async createTaskType(taskType: any) {
      return this.taskTypeStorage.createTaskType(taskType);
    }

    async getTaskTypeById(id: string) {
      return this.taskTypeStorage.getTaskTypeById(id);
    }

    async getAllTaskTypes(includeInactive = false) {
      return this.taskTypeStorage.getAllTaskTypes(includeInactive);
    }

    async getActiveTaskTypes() {
      return this.taskTypeStorage.getActiveTaskTypes();
    }

    async updateTaskType(id: string, taskType: any) {
      return this.taskTypeStorage.updateTaskType(id, taskType);
    }

    async deleteTaskType(id: string) {
      return this.taskTypeStorage.deleteTaskType(id);
    }

    // ============================================================================
    // INTERNAL TASK OPERATIONS - InternalTaskStorage (14 methods)
    // ============================================================================

    async createInternalTask(task: any) {
      return this.internalTaskStorage.createInternalTask(task);
    }

    async getInternalTaskById(id: string) {
      return this.internalTaskStorage.getInternalTaskById(id);
    }

    async getInternalTasksByAssignee(assigneeId: string, filters?: { status?: string; priority?: string }) {
      return this.internalTaskStorage.getInternalTasksByAssignee(assigneeId, filters);
    }

    async getInternalTasksByCreator(creatorId: string, filters?: { status?: string; priority?: string }) {
      return this.internalTaskStorage.getInternalTasksByCreator(creatorId, filters);
    }

    async getAllInternalTasks(filters?: { status?: string; priority?: string; assigneeId?: string; creatorId?: string }) {
      return this.internalTaskStorage.getAllInternalTasks(filters);
    }

    async getInternalTasksByClient(clientId: string) {
      return this.internalTaskStorage.getInternalTasksByClient(clientId);
    }

    async getInternalTasksByProject(projectId: string) {
      return this.internalTaskStorage.getInternalTasksByProject(projectId);
    }

    async updateInternalTask(id: string, task: any) {
      return this.internalTaskStorage.updateInternalTask(id, task);
    }

    async closeInternalTask(id: string, closeData: any, userId: string) {
      return this.internalTaskStorage.closeInternalTask(id, closeData, userId);
    }

    async deleteInternalTask(id: string) {
      return this.internalTaskStorage.deleteInternalTask(id);
    }

    async archiveInternalTask(id: string, userId: string) {
      return this.internalTaskStorage.archiveInternalTask(id, userId);
    }

    async unarchiveInternalTask(id: string) {
      return this.internalTaskStorage.unarchiveInternalTask(id);
    }

    async bulkReassignTasks(taskIds: string[], assignedTo: string) {
      return this.internalTaskStorage.bulkReassignTasks(taskIds, assignedTo);
    }

    async bulkUpdateTaskStatus(taskIds: string[], status: string) {
      return this.internalTaskStorage.bulkUpdateTaskStatus(taskIds, status);
    }

    // ============================================================================
    // TASK CONNECTION OPERATIONS - InternalTaskStorage (3 methods)
    // ============================================================================

    async createTaskConnection(connection: any) {
      return this.internalTaskStorage.createTaskConnection(connection);
    }

    async getTaskConnectionsByTaskId(taskId: string) {
      return this.internalTaskStorage.getTaskConnectionsByTaskId(taskId);
    }

    async deleteTaskConnection(id: string) {
      return this.internalTaskStorage.deleteTaskConnection(id);
    }

    // ============================================================================
    // TASK PROGRESS NOTES OPERATIONS - InternalTaskStorage (3 methods)
    // ============================================================================

    async createTaskProgressNote(note: any) {
      return this.internalTaskStorage.createTaskProgressNote(note);
    }

    async getTaskProgressNotesByTaskId(taskId: string) {
      return this.internalTaskStorage.getTaskProgressNotesByTaskId(taskId);
    }

    async deleteTaskProgressNote(id: string) {
      return this.internalTaskStorage.deleteTaskProgressNote(id);
    }

    // ============================================================================
    // TASK DOCUMENT OPERATIONS - InternalTaskStorage (5 methods)
    // ============================================================================

    async createTaskDocument(document: any) {
      return this.internalTaskStorage.createTaskDocument(document);
    }

    async getTaskDocument(id: string) {
      return this.internalTaskStorage.getTaskDocument(id);
    }

    async getTaskDocuments(taskId: string) {
      return this.internalTaskStorage.getTaskDocuments(taskId);
    }

    async getTaskDocumentsByTaskId(taskId: string) {
      return this.internalTaskStorage.getTaskDocuments(taskId);
    }

    async deleteTaskDocument(id: string) {
      return this.internalTaskStorage.deleteTaskDocument(id);
    }

    // ============================================================================
    // TASK TIME ENTRY OPERATIONS - TaskTimeEntryStorage (5 methods)
    // ============================================================================

    async createTaskTimeEntry(entry: any) {
      return this.taskTimeEntryStorage.createTaskTimeEntry(entry);
    }

    async getTaskTimeEntriesByTaskId(taskId: string) {
      return this.taskTimeEntryStorage.getTaskTimeEntriesByTaskId(taskId);
    }

    async getActiveTaskTimeEntry(taskId: string, userId: string) {
      return this.taskTimeEntryStorage.getActiveTaskTimeEntry(taskId, userId);
    }

    async stopTaskTimeEntry(id: string, stopData: any) {
      return this.taskTimeEntryStorage.stopTaskTimeEntry(id, stopData);
    }

    async deleteTaskTimeEntry(id: string) {
      return this.taskTimeEntryStorage.deleteTaskTimeEntry(id);
    }
  };
}
