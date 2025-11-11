import { useState } from "react";
import SwipeableProjectCard from "./swipeable-project-card";
import { StageChangeModal } from "./stage-change-modal";
import { MessagesModal } from "./messages-modal";
import type { ProjectWithRelations, User } from "@shared/schema";

interface TaskListMobileViewProps {
  projects: ProjectWithRelations[];
  user: User;
}

export default function TaskListMobileView({ projects, user }: TaskListMobileViewProps) {
  // State for StageChangeModal and MessagesModal
  const [showStageChangeModal, setShowStageChangeModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [modalProjectId, setModalProjectId] = useState<string | null>(null);

  // Handlers for quick actions
  const handleShowInfo = (projectId: string) => {
    setModalProjectId(projectId);
    setShowStageChangeModal(true);
  };

  const handleShowMessages = (projectId: string) => {
    setModalProjectId(projectId);
    setShowMessagesModal(true);
  };

  return (
    <>
      <div className="space-y-0">
        {projects.map((project) => {
          // Determine if user can complete this project
          const canComplete = !project.completionStatus && (
            user.isAdmin ||
            project.currentAssigneeId === user.id ||
            project.clientManagerId === user.id ||
            project.bookkeeperId === user.id
          );

          return (
            <SwipeableProjectCard
              key={project.id}
              project={project}
              canComplete={canComplete}
              onShowInfo={handleShowInfo}
              onShowMessages={handleShowMessages}
            />
          );
        })}
      </div>

      {/* Stage Change Info Modal */}
      {modalProjectId && (
        <StageChangeModal
          projectId={modalProjectId}
          open={showStageChangeModal}
          onOpenChange={setShowStageChangeModal}
        />
      )}

      {/* Messages Modal */}
      {modalProjectId && (
        <MessagesModal
          projectId={modalProjectId}
          open={showMessagesModal}
          onOpenChange={setShowMessagesModal}
        />
      )}
    </>
  );
}
