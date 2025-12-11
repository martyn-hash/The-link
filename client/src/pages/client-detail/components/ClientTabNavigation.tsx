import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TAB_LIST = ["overview", "services", "projects", "communications", "chronology", "documents", "tasks", "approvals", "risk"] as const;

type TabValue = typeof TAB_LIST[number];

export interface ClientTabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  riskView: "risk" | "notifications";
  onRiskViewChange: (view: "risk" | "notifications") => void;
  isMobile: boolean;
}

function scrollTabIntoView(testId: string) {
  const container = document.querySelector('.snap-x');
  const tab = document.querySelector(`[data-testid="${testId}"]`);
  if (container && tab) {
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

function MobileTabTrigger({ 
  value, 
  label, 
  testId 
}: { 
  value: TabValue; 
  label: string; 
  testId: string; 
}) {
  return (
    <TabsTrigger 
      value={value} 
      data-testid={testId} 
      className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" 
      style={{ width: '80vw' }}
      onClick={() => scrollTabIntoView(testId)}
    >
      {label}
    </TabsTrigger>
  );
}

export function ClientTabNavigation({ 
  activeTab, 
  onTabChange, 
  riskView, 
  onRiskViewChange,
  isMobile 
}: ClientTabNavigationProps) {
  const handlePrevTab = () => {
    const currentIndex = TAB_LIST.indexOf(activeTab as TabValue);
    if (currentIndex > 0) {
      onTabChange(TAB_LIST[currentIndex - 1]);
    }
  };

  const handleNextTab = () => {
    const currentIndex = TAB_LIST.indexOf(activeTab as TabValue);
    if (currentIndex < TAB_LIST.length - 1) {
      onTabChange(TAB_LIST[currentIndex + 1]);
    }
  };

  return (
    <>
      {/* Desktop Tabs - Grid Layout */}
      <div className="hidden md:block w-full">
        <TabsList className="grid w-full grid-cols-9 gap-1 h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview" className="text-sm py-2">Overview</TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-services" className="text-sm py-2">Services</TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-projects" className="text-sm py-2">Projects</TabsTrigger>
          <TabsTrigger value="communications" data-testid="tab-communications" className="text-sm py-2">Comms</TabsTrigger>
          <TabsTrigger value="chronology" data-testid="tab-chronology" className="text-sm py-2">History</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents" className="text-sm py-2">Docs</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks" className="text-sm py-2">Tasks</TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals" className="text-sm py-2">Approvals</TabsTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={activeTab === "risk" ? "secondary" : "ghost"}
                className="text-sm py-2 h-9 px-3 w-full"
                data-testid="dropdown-risk-notifications"
              >
                <span>More...</span>
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  onTabChange("risk");
                  onRiskViewChange("risk");
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                data-testid="menu-item-risk"
              >
                Risk
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onTabChange("risk");
                  onRiskViewChange("notifications");
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                data-testid="menu-item-notifications"
              >
                Notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TabsList>
      </div>

      {/* Mobile Tabs - Carousel with Peek Preview and Arrow Navigation */}
      <div className="md:hidden w-full relative">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
          onClick={handlePrevTab}
          disabled={activeTab === "overview"}
          data-testid="tab-nav-left"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
          onClick={handleNextTab}
          disabled={activeTab === "risk"}
          data-testid="tab-nav-right"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>

        <div className="w-full overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-[10vw]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <TabsList className="inline-flex gap-2 h-auto">
            <MobileTabTrigger value="overview" label="Overview" testId="tab-overview" />
            <MobileTabTrigger value="services" label="Services" testId="tab-services" />
            <MobileTabTrigger value="projects" label="Projects" testId="tab-projects" />
            <MobileTabTrigger value="communications" label="Comms" testId="tab-communications" />
            <MobileTabTrigger value="chronology" label="History" testId="tab-chronology" />
            <MobileTabTrigger value="documents" label="Docs" testId="tab-documents" />
            <MobileTabTrigger value="tasks" label="Tasks" testId="tab-tasks" />
            <MobileTabTrigger value="approvals" label="Approvals" testId="tab-approvals" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={activeTab === "risk" ? "secondary" : "ghost"}
                  className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0"
                  style={{ width: '80vw' }}
                  data-testid="dropdown-risk-notifications-mobile"
                >
                  <span>More...</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    onTabChange("risk");
                    onRiskViewChange("risk");
                  }}
                  className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                  data-testid="menu-item-risk-mobile"
                >
                  Risk
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onTabChange("risk");
                    onRiskViewChange("notifications");
                  }}
                  className="bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700"
                  data-testid="menu-item-notifications-mobile"
                >
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsList>
        </div>
      </div>

      {/* Mobile Section Title - Shows current tab name */}
      {isMobile && (
        <div className="mt-4 mb-2">
          <h2 className="text-lg font-semibold text-foreground" data-testid="mobile-section-title">
            {activeTab === "overview" && "Overview"}
            {activeTab === "services" && "Services"}
            {activeTab === "projects" && "Projects"}
            {activeTab === "communications" && "Communications"}
            {activeTab === "chronology" && "History"}
            {activeTab === "documents" && "Documents"}
            {activeTab === "tasks" && "Tasks"}
            {activeTab === "approvals" && "Approval Overrides"}
            {activeTab === "risk" && (riskView === "risk" ? "Risk Assessment" : "Notifications")}
          </h2>
        </div>
      )}
    </>
  );
}
