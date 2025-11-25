import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArrowLeft, Settings } from "lucide-react";
import type { ProjectType } from "@shared/schema";

interface PageHeaderProps {
  projectType: ProjectType;
  isActiveTogglePending: boolean;
  isSingleProjectTogglePending: boolean;
  onActiveToggle: (checked: boolean) => void;
  onSingleProjectToggle: (checked: boolean) => void;
}

export function PageHeader({
  projectType,
  isActiveTogglePending,
  isSingleProjectTogglePending,
  onActiveToggle,
  onSingleProjectToggle,
}: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="page-container py-6 md:py-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/settings" data-testid="breadcrumb-settings">
                  Settings
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-project-type">
                {projectType.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground flex items-center" data-testid="text-project-type-name">
                <Settings className="w-6 h-6 mr-3 text-primary" />
                {projectType.name}
              </h1>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active-toggle"
                    checked={projectType.active !== false}
                    onCheckedChange={onActiveToggle}
                    disabled={isActiveTogglePending}
                    data-testid="switch-active-project-type"
                  />
                  <Label 
                    htmlFor="active-toggle" 
                    className="text-sm font-medium cursor-pointer"
                    data-testid="label-active-project-type"
                  >
                    {projectType.active !== false ? "Active" : "Inactive"}
                  </Label>
                </div>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2" data-testid="tooltip-trigger-single-project">
                        <Switch
                          id="single-project-toggle"
                          checked={projectType.singleProjectPerClient === true}
                          onCheckedChange={onSingleProjectToggle}
                          disabled={isSingleProjectTogglePending}
                          data-testid="switch-single-project-per-client"
                        />
                        <Label 
                          htmlFor="single-project-toggle" 
                          className="text-sm font-medium cursor-pointer"
                          data-testid="label-single-project-per-client"
                        >
                          Single Project Per Client
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent data-testid="tooltip-content-single-project">
                      <p className="max-w-xs">
                        When enabled, scheduling a new project will automatically archive any active projects of this type for the same client as unsuccessfully completed.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            {projectType.description && (
              <p className="text-muted-foreground mt-1" data-testid="text-project-type-description">
                {projectType.description}
              </p>
            )}
          </div>
          <Link href="/settings">
            <Button variant="outline" data-testid="button-back-to-project-types">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Project Types
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
