import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  X,
  HelpCircle,
  Plus,
  CalendarIcon,
  Trash2,
  Upload
} from "lucide-react";
import { QueryBulkImport, type ParsedQuery } from "@/components/queries/QueryBulkImport";
import { format } from "date-fns";
import type { PendingQuery } from "@/types/changeStatus";

interface QueriesFormProps {
  pendingQueries: PendingQuery[];
  onAddQueryRow: () => void;
  onUpdateQuery: (id: string, field: string, value: any) => void;
  onRemoveQuery: (id: string) => void;
  onBulkImport: (importedQueries: ParsedQuery[]) => void;
  onClose: () => void;
}

export function QueriesForm({
  pendingQueries,
  onAddQueryRow,
  onUpdateQuery,
  onRemoveQuery,
  onBulkImport,
  onClose,
}: QueriesFormProps) {
  return (
    <div className="space-y-4 border-l pl-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Add Queries</h3>
          {pendingQueries.length > 0 && (
            <Badge variant="secondary">{pendingQueries.length}</Badge>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6"
          data-testid="button-close-queries"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Add transaction queries to be resolved. These will be saved with this stage change.
      </p>

      <div className="space-y-2">
        {pendingQueries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No queries added yet</p>
            <p className="text-xs">Click the button below to add a query</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {pendingQueries.map((query, index) => (
              <div 
                key={query.id} 
                className="p-3 bg-muted/30 rounded-lg space-y-3 relative"
                data-testid={`query-row-${index}`}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => onRemoveQuery(query.id)}
                  data-testid={`button-remove-query-${index}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left font-normal h-8 text-xs"
                          data-testid={`button-date-${index}`}
                        >
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {query.date ? format(query.date, "dd MMM yy") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={query.date || undefined}
                          onSelect={(date) => onUpdateQuery(query.id, "date", date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Amount (£)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={query.moneyOut}
                      onChange={(e) => onUpdateQuery(query.id, "moneyOut", e.target.value)}
                      className="h-8 text-xs"
                      data-testid={`input-amount-${index}`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="Transaction description..."
                    value={query.description}
                    onChange={(e) => onUpdateQuery(query.id, "description", e.target.value)}
                    className="h-8 text-xs"
                    data-testid={`input-description-${index}`}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Query</Label>
                  <Textarea
                    placeholder="What do you need to ask about this transaction?"
                    value={query.ourQuery}
                    onChange={(e) => onUpdateQuery(query.id, "ourQuery", e.target.value)}
                    className="text-xs min-h-[60px]"
                    rows={2}
                    data-testid={`input-query-${index}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddQueryRow}
            className="flex-1"
            data-testid="button-add-query-row"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Row
          </Button>
          <QueryBulkImport
            onImport={onBulkImport}
            trigger={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                data-testid="button-import-queries"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import File
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
