import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type CompanyView } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Filter, 
  Save, 
  Trash2, 
  Star,
  X,
  Briefcase,
  Tag,
  Calendar
} from "lucide-react";

interface CompanyFilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Filter states
  selectedServices: string[];
  setSelectedServices: (value: string[]) => void;
  selectedTags: string[];
  setSelectedTags: (value: string[]) => void;
  daysUntilDueFilter: string[];
  setDaysUntilDueFilter: (value: string[]) => void;
  
  // Data for dropdowns
  services: { id: string; name: string }[];
  tags: { id: string; name: string; color: string }[];
}

export default function CompanyFilterPanel({
  open,
  onOpenChange,
  selectedServices,
  setSelectedServices,
  selectedTags,
  setSelectedTags,
  daysUntilDueFilter,
  setDaysUntilDueFilter,
  services,
  tags,
}: CompanyFilterPanelProps) {
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  // Fetch saved views
  const { data: savedViews = [] } = useQuery<CompanyView[]>({
    queryKey: ["/api/company-views"],
  });

  // Save view mutation
  const saveViewMutation = useMutation({
    mutationFn: async (name: string) => {
      const filters = {
        selectedServices,
        selectedTags,
        daysUntilDueFilter,
      };

      return await apiRequest(
        "POST",
        "/api/company-views",
        { name, filters: JSON.stringify(filters) }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-views"] });
      setSaveViewDialogOpen(false);
      setViewName("");
    },
  });

  // Delete view mutation
  const deleteViewMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(
        "DELETE",
        `/api/company-views/${id}`
      );
      return id;
    },
    onSuccess: (deletedId) => {
      // Eagerly update the cache by removing the deleted view
      queryClient.setQueryData<CompanyView[]>(["/api/company-views"], (oldData) => {
        return oldData ? oldData.filter(view => view.id !== deletedId) : oldData;
      });
    },
  });

  const handleClearAll = () => {
    setSelectedServices([]);
    setSelectedTags([]);
    setDaysUntilDueFilter([]);
  };

  const handleLoadView = (view: CompanyView) => {
    const filters = typeof view.filters === 'string' 
      ? JSON.parse(view.filters) 
      : view.filters as any;
    
    setSelectedServices(filters.selectedServices || []);
    setSelectedTags(filters.selectedTags || []);
    setDaysUntilDueFilter(filters.daysUntilDueFilter || []);
  };

  const activeFilterCount = () => {
    let count = 0;
    if (selectedServices.length > 0) count++;
    if (selectedTags.length > 0) count++;
    if (daysUntilDueFilter.length > 0) count++;
    return count;
  };

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices((prev: string[]) =>
      prev.includes(serviceId)
        ? prev.filter((id: string) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev: string[]) =>
      prev.includes(tagId)
        ? prev.filter((id: string) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleDaysUntilToggle = (range: string) => {
    setDaysUntilDueFilter((prev: string[]) =>
      prev.includes(range)
        ? prev.filter((r: string) => r !== range)
        : [...prev, range]
    );
  };

  const daysUntilRanges = [
    { value: "1-10", label: "1-10 days" },
    { value: "11-31", label: "11-31 days" },
    { value: "32-60", label: "32-60 days" },
    { value: "61-90", label: "61-90 days" },
    { value: "90+", label: "90+ days" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Views
            </SheetTitle>
            <SheetDescription>
              Apply filters to narrow down companies, or save your current view for quick access.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Active Filters Info */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {activeFilterCount()} active {activeFilterCount() === 1 ? 'filter' : 'filters'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={activeFilterCount() === 0}
                data-testid="button-clear-all-filters"
              >
                <X className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>

            <Separator />

            {/* Services Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Services
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    data-testid="button-services-filter"
                  >
                    {selectedServices.length === 0
                      ? "All Services"
                      : selectedServices.length === 1
                      ? services.find(s => s.id === selectedServices[0])?.name
                      : `${selectedServices.length} services selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">Select Services</h4>
                      {selectedServices.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedServices([])}
                          className="h-auto p-1 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {services.map((service) => (
                        <div key={service.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`service-${service.id}`}
                            checked={selectedServices.includes(service.id)}
                            onCheckedChange={() => handleServiceToggle(service.id)}
                            data-testid={`checkbox-service-${service.id}`}
                          />
                          <label
                            htmlFor={`service-${service.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {service.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Separator />

            {/* Tags Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    data-testid="button-tags-filter"
                  >
                    {selectedTags.length === 0
                      ? "All Tags"
                      : selectedTags.length === 1
                      ? tags.find(t => t.id === selectedTags[0])?.name
                      : `${selectedTags.length} tags selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">Select Tags</h4>
                      {selectedTags.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTags([])}
                          className="h-auto p-1 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {tags.map((tag) => (
                        <div key={tag.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag.id}`}
                            checked={selectedTags.includes(tag.id)}
                            onCheckedChange={() => handleTagToggle(tag.id)}
                            data-testid={`checkbox-tag-${tag.id}`}
                          />
                          <label
                            htmlFor={`tag-${tag.id}`}
                            className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Separator />

            {/* Days Until Accounts Due Filter */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Days Until Accounts Due
              </Label>
              <div className="space-y-2">
                {daysUntilRanges.map((range) => (
                  <div key={range.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`days-${range.value}`}
                      checked={daysUntilDueFilter.includes(range.value)}
                      onCheckedChange={() => handleDaysUntilToggle(range.value)}
                      data-testid={`checkbox-days-${range.value}`}
                    />
                    <label
                      htmlFor={`days-${range.value}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {range.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Saved Views */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Saved Views
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSaveViewDialogOpen(true)}
                  data-testid="button-save-current-view"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Current
                </Button>
              </div>

              {savedViews.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No saved views yet. Save your current filters for quick access.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedViews.map((view) => (
                    <div
                      key={view.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent group"
                    >
                      <button
                        onClick={() => handleLoadView(view)}
                        className="flex-1 text-left text-sm font-medium"
                        data-testid={`button-load-view-${view.id}`}
                      >
                        {view.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteViewMutation.mutate(view.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-delete-view-${view.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Save View Dialog */}
      <Dialog open={saveViewDialogOpen} onOpenChange={setSaveViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription>
              Give your current filter configuration a name for easy access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g., My Active Clients"
                data-testid="input-view-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveViewDialogOpen(false)}
              data-testid="button-cancel-save-view"
            >
              Cancel
            </Button>
            <Button
              onClick={() => saveViewMutation.mutate(viewName)}
              disabled={!viewName.trim() || saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
