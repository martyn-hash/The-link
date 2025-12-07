import { useState, useCallback } from "react";
import type { PendingQuery } from "@/types/changeStatus";
import type { ParsedQuery } from "@/components/queries/QueryBulkImport";

interface UseQueriesManagementReturn {
  showQueriesForm: boolean;
  pendingQueries: PendingQuery[];
  handleToggleQueriesForm: () => void;
  handleAddQueryRow: () => void;
  handleUpdateQuery: (id: string, field: string, value: any) => void;
  handleRemoveQuery: (id: string) => void;
  handleBulkImportQueries: (importedQueries: ParsedQuery[]) => void;
  resetQueries: () => void;
}

export function useQueriesManagement(): UseQueriesManagementReturn {
  const [showQueriesForm, setShowQueriesForm] = useState(false);
  const [pendingQueries, setPendingQueries] = useState<PendingQuery[]>([]);

  const handleToggleQueriesForm = useCallback(() => {
    setShowQueriesForm(prev => !prev);
  }, []);

  const handleAddQueryRow = useCallback(() => {
    setPendingQueries(prev => [...prev, {
      id: crypto.randomUUID(),
      date: null,
      description: "",
      moneyIn: "",
      moneyOut: "",
      ourQuery: "",
    }]);
  }, []);

  const handleUpdateQuery = useCallback((id: string, field: string, value: any) => {
    setPendingQueries(prev => prev.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  }, []);

  const handleRemoveQuery = useCallback((id: string) => {
    setPendingQueries(prev => prev.filter(q => q.id !== id));
  }, []);

  const handleBulkImportQueries = useCallback((importedQueries: ParsedQuery[]) => {
    const newQueries: PendingQuery[] = importedQueries.map(q => ({
      id: crypto.randomUUID(),
      date: q.date,
      description: q.description,
      moneyIn: q.moneyIn,
      moneyOut: q.moneyOut,
      ourQuery: q.ourQuery,
    }));
    setPendingQueries(prev => [...prev, ...newQueries]);
  }, []);

  const resetQueries = useCallback(() => {
    setShowQueriesForm(false);
    setPendingQueries([]);
  }, []);

  return {
    showQueriesForm,
    pendingQueries,
    handleToggleQueriesForm,
    handleAddQueryRow,
    handleUpdateQuery,
    handleRemoveQuery,
    handleBulkImportQueries,
    resetQueries,
  };
}
