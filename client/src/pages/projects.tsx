import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import TopNavigation from "@/components/top-navigation";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import FilterPanel from "@/components/filter-panel";
import { useProjectsPageState } from "@/hooks/projects-page/useProjectsPageState";
import { ProjectsHeader } from "@/components/projects-page/ProjectsHeader";
import { ProjectsContent } from "@/components/projects-page/ProjectsContent";
import type { CompanySettings } from "@shared/schema";
import {
  CreateDashboardModal,
  AddWidgetDialog,
  SaveViewDialog,
  DeleteViewDialog,
  DeleteDashboardDialog,
} from "@/components/projects-page/modals";

export type { Widget, Dashboard } from "@/types/projects-page";

export default function Projects() {
  const [, setLocation] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  
  const state = useProjectsPageState();

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const emailModuleActive = companySettings?.emailModuleActive || false;

  useEffect(() => {
    if (state.error && isUnauthorizedError(state.error)) {
      setLocation("/");
    }
  }, [state.error, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNavigation 
        user={state.user} 
        onMobileSearchClick={() => state.setMobileSearchOpen(true)} 
      />

      <main className="flex-1 pb-20">
        <ProjectsHeader
          workspaceMode={state.workspaceMode}
          setWorkspaceMode={state.setWorkspaceMode}
          viewMode={state.viewMode}
          openTasksAndRemindersCount={state.openTasksAndRemindersCount}
          isMobile={state.isMobile}
          emailModuleActive={emailModuleActive}
          currentSavedViewId={state.currentSavedViewId}
          currentSavedViewName={state.currentSavedViewName}
          currentDashboard={state.currentDashboard}
          kanbanCompactMode={state.kanbanCompactMode}
          dashboardWidgets={state.dashboardWidgets}
          dashboardDescription={state.dashboardDescription}
          dashboardIsHomescreen={state.dashboardIsHomescreen}
          dashboardVisibility={state.dashboardVisibility}
          tasksOwnershipFilter={state.tasksOwnershipFilter}
          tasksStatusFilter={state.tasksStatusFilter}
          tasksPriorityFilter={state.tasksPriorityFilter}
          tasksAssigneeFilter={state.tasksAssigneeFilter}
          tasksDateFromFilter={state.tasksDateFromFilter}
          tasksDateToFilter={state.tasksDateToFilter}
          tasksSearchQuery={state.tasksSearchQuery}
          tasksActiveFilterCount={state.tasksActiveFilterCount}
          canSeeAllTasks={state.user?.canSeeAllTasks || false}
          tasksReassignMode={state.tasksReassignMode}
          setTasksOwnershipFilter={state.setTasksOwnershipFilter}
          setTasksStatusFilter={state.setTasksStatusFilter}
          setTasksPriorityFilter={state.setTasksPriorityFilter}
          setTasksAssigneeFilter={state.setTasksAssigneeFilter}
          setTasksDateFromFilter={state.setTasksDateFromFilter}
          setTasksDateToFilter={state.setTasksDateToFilter}
          setTasksSearchQuery={state.setTasksSearchQuery}
          setTasksReassignMode={state.setTasksReassignMode}
          clearTasksFilters={state.clearTasksFilters}
          handleManualViewModeChange={state.handleManualViewModeChange}
          handleLoadSavedView={state.handleLoadSavedView}
          handleLoadDashboard={state.handleLoadDashboard}
          handleUpdateCurrentView={state.handleUpdateCurrentView}
          handleSaveDashboardAsNew={state.handleSaveDashboardAsNew}
          toggleKanbanCompactMode={state.toggleKanbanCompactMode}
          activeFilterCount={state.activeFilterCount}
          setFilterPanelOpen={state.setFilterPanelOpen}
          setSaveViewDialogOpen={state.setSaveViewDialogOpen}
          onOpenCreateDashboard={() => state.openCreateDashboardModal()}
          onOpenEditDashboard={() => state.openCreateDashboardModal(state.currentDashboard)}
        />

        <ProjectsContent
          workspaceMode={state.workspaceMode}
          viewMode={state.viewMode}
          isMobile={state.isMobile}
          projectsLoading={state.projectsLoading}
          usersLoading={state.usersLoading}
          isManagerOrAdmin={state.isManagerOrAdmin}
          user={state.user!}
          paginatedProjects={state.paginatedProjects}
          filteredProjects={state.filteredProjects}
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          startIndex={state.startIndex}
          endIndex={state.endIndex}
          itemsPerPage={state.itemsPerPage}
          setCurrentPage={state.setCurrentPage}
          setItemsPerPage={state.setItemsPerPage}
          tasksOwnershipFilter={state.tasksOwnershipFilter}
          tasksStatusFilter={state.tasksStatusFilter}
          tasksPriorityFilter={state.tasksPriorityFilter}
          tasksAssigneeFilter={state.tasksAssigneeFilter}
          tasksDateFromFilter={state.tasksDateFromFilter}
          tasksDateToFilter={state.tasksDateToFilter}
          tasksSearchQuery={state.tasksSearchQuery}
          tasksReassignMode={state.tasksReassignMode}
          setTasksOwnershipFilter={state.setTasksOwnershipFilter}
          setTasksStatusFilter={state.setTasksStatusFilter}
          setTasksPriorityFilter={state.setTasksPriorityFilter}
          setTasksAssigneeFilter={state.setTasksAssigneeFilter}
          setTasksDateFromFilter={state.setTasksDateFromFilter}
          setTasksDateToFilter={state.setTasksDateToFilter}
          setTasksSearchQuery={state.setTasksSearchQuery}
          setTasksReassignMode={state.setTasksReassignMode}
          handleRefresh={state.handleRefresh}
          handleManualViewModeChange={state.handleManualViewModeChange}
          handleCalendarEventClick={state.handleCalendarEventClick}
          dashboardServiceFilter={state.dashboardServiceFilter}
          dashboardTaskAssigneeFilter={state.dashboardTaskAssigneeFilter}
          dashboardServiceOwnerFilter={state.dashboardServiceOwnerFilter}
          dashboardUserFilter={state.dashboardUserFilter}
          dashboardShowArchived={state.dashboardShowArchived}
          dashboardDynamicDateFilter={state.dashboardDynamicDateFilter}
          dashboardCustomDateRange={state.dashboardCustomDateRange}
          dashboardClientFilter={state.dashboardClientFilter}
          dashboardProjectTypeFilter={state.dashboardProjectTypeFilter}
          dashboardWidgets={state.dashboardWidgets}
          dashboardEditMode={state.dashboardEditMode}
          currentDashboard={state.currentDashboard}
          kanbanCompactMode={state.kanbanCompactMode}
          kanbanExpandedStages={state.kanbanExpandedStages}
          toggleKanbanCompactMode={state.toggleKanbanCompactMode}
          setKanbanExpandedStages={state.setKanbanExpandedStages}
          setDashboardWidgets={state.setDashboardWidgets}
          serviceFilter={state.serviceFilter}
          taskAssigneeFilter={state.taskAssigneeFilter}
          serviceOwnerFilter={state.serviceOwnerFilter}
          userFilter={state.userFilter}
          showArchived={state.showArchived}
          calendarSettings={state.calendarSettings}
          setCalendarSettings={state.setCalendarSettings}
          onAddDashboardWidget={() => state.setNewWidgetDialogOpen(true)}
          listSortBy={state.listSortBy}
          listSortOrder={state.listSortOrder}
          onListSortChange={state.handleListSortChange}
          pivotConfig={state.pivotConfig}
          onPivotConfigChange={state.onPivotConfigChange}
          currentSavedViewId={state.currentSavedViewId}
        />
      </main>

      <BottomNav 
        user={state.user} 
        onSearchClick={() => state.setMobileSearchOpen(true)} 
      />

      {/* Mobile-only search modal */}
      <div className="md:hidden">
        <SuperSearch
          isOpen={state.mobileSearchOpen}
          onOpenChange={(open) => state.setMobileSearchOpen(open)}
        />
      </div>

      <FilterPanel
        open={state.filterPanelOpen}
        onOpenChange={state.setFilterPanelOpen}
        serviceFilter={state.serviceFilter}
        setServiceFilter={state.setServiceFilter}
        taskAssigneeFilter={state.taskAssigneeFilter}
        setTaskAssigneeFilter={state.setTaskAssigneeFilter}
        serviceOwnerFilter={state.serviceOwnerFilter}
        setServiceOwnerFilter={state.setServiceOwnerFilter}
        userFilter={state.userFilter}
        setUserFilter={state.setUserFilter}
        showArchived={state.showArchived}
        setShowArchived={state.setShowArchived}
        showCompletedRegardless={state.showCompletedRegardless}
        setShowCompletedRegardless={state.setShowCompletedRegardless}
        dynamicDateFilter={state.dynamicDateFilter}
        setDynamicDateFilter={state.setDynamicDateFilter}
        customDateRange={state.customDateRange}
        setCustomDateRange={state.setCustomDateRange}
        serviceDueDateFilter={state.serviceDueDateFilter}
        setServiceDueDateFilter={state.setServiceDueDateFilter}
        scheduleStatusFilter={state.scheduleStatusFilter}
        setScheduleStatusFilter={state.setScheduleStatusFilter}
        viewMode={state.viewMode}
        setViewMode={state.handleManualViewModeChange}
        services={state.allServices || []}
        users={state.users || []}
        taskAssignees={state.taskAssignees || []}
        serviceOwners={state.serviceOwners || []}
        isManagerOrAdmin={state.isManagerOrAdmin}
        allProjectTypes={state.allProjectTypes || []}
        clientHasProjectTypeIds={state.clientHasProjectTypeIds}
        setClientHasProjectTypeIds={state.setClientHasProjectTypeIds}
      />

      <CreateDashboardModal
        open={state.createDashboardModalOpen}
        onOpenChange={state.setCreateDashboardModalOpen}
        isCreatingDashboard={state.isCreatingDashboard}
        newDashboardName={state.newDashboardName}
        setNewDashboardName={state.setNewDashboardName}
        newDashboardDescription={state.newDashboardDescription}
        setNewDashboardDescription={state.setNewDashboardDescription}
        newDashboardIsHomescreen={state.newDashboardIsHomescreen}
        setNewDashboardIsHomescreen={state.setNewDashboardIsHomescreen}
        newDashboardVisibility={state.newDashboardVisibility}
        setNewDashboardVisibility={state.setNewDashboardVisibility}
        newDashboardWidgets={state.newDashboardWidgets}
        dashboardServiceFilter={state.dashboardServiceFilter}
        setDashboardServiceFilter={state.setDashboardServiceFilter}
        dashboardTaskAssigneeFilter={state.dashboardTaskAssigneeFilter}
        setDashboardTaskAssigneeFilter={state.setDashboardTaskAssigneeFilter}
        dashboardServiceOwnerFilter={state.dashboardServiceOwnerFilter}
        setDashboardServiceOwnerFilter={state.setDashboardServiceOwnerFilter}
        dashboardUserFilter={state.dashboardUserFilter}
        setDashboardUserFilter={state.setDashboardUserFilter}
        dashboardShowArchived={state.dashboardShowArchived}
        setDashboardShowArchived={state.setDashboardShowArchived}
        dashboardDynamicDateFilter={state.dashboardDynamicDateFilter}
        setDashboardDynamicDateFilter={state.setDashboardDynamicDateFilter}
        dashboardClientFilter={state.dashboardClientFilter}
        setDashboardClientFilter={state.setDashboardClientFilter}
        dashboardProjectTypeFilter={state.dashboardProjectTypeFilter}
        setDashboardProjectTypeFilter={state.setDashboardProjectTypeFilter}
        services={state.allServices || []}
        users={state.users || []}
        taskAssignees={state.taskAssignees || []}
        serviceOwners={state.serviceOwners || []}
        allClients={state.allClients || []}
        allProjectTypes={state.allProjectTypes || []}
        dashboards={state.dashboards || []}
        isManagerOrAdmin={state.isManagerOrAdmin}
        onSave={state.handleSaveNewDashboard}
        onOpenAddWidget={() => state.setNewWidgetDialogOpen(true)}
        onRemoveWidget={state.handleRemoveWidgetFromNewDashboard}
        isSaving={state.saveDashboardMutation.isPending}
        onReset={state.resetNewDashboardState}
      />

      <AddWidgetDialog
        open={state.newWidgetDialogOpen}
        onOpenChange={state.setNewWidgetDialogOpen}
        newWidgetType={state.newWidgetType}
        setNewWidgetType={state.setNewWidgetType}
        newWidgetTitle={state.newWidgetTitle}
        setNewWidgetTitle={state.setNewWidgetTitle}
        newWidgetGroupBy={state.newWidgetGroupBy}
        setNewWidgetGroupBy={state.setNewWidgetGroupBy}
        onAddWidget={state.handleAddWidgetToNewDashboard}
      />

      <SaveViewDialog
        open={state.saveViewDialogOpen}
        onOpenChange={state.setSaveViewDialogOpen}
        newViewName={state.newViewName}
        setNewViewName={state.setNewViewName}
        viewMode={state.viewMode}
        onSave={state.handleSaveView}
        isSaving={state.saveViewMutation.isPending}
      />

      <DeleteViewDialog
        open={state.deleteViewDialogOpen}
        onOpenChange={state.setDeleteViewDialogOpen}
        viewToDelete={state.viewToDelete}
        onConfirmDelete={state.handleConfirmDeleteView}
      />

      <DeleteDashboardDialog
        open={state.deleteDashboardDialogOpen}
        onOpenChange={state.setDeleteDashboardDialogOpen}
        dashboardToDelete={state.dashboardToDelete}
        onConfirmDelete={state.handleConfirmDeleteDashboard}
      />
    </div>
  );
}
