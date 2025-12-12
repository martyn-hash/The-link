import { useState, useEffect, useCallback, useRef } from 'react';

interface DraftData {
  content: string;
  savedAt: number;
  additionalFields?: Record<string, any>;
}

interface UseDraftAutoSaveOptions {
  key: string;
  debounceMs?: number;
  maxAgeMs?: number;
}

interface UseDraftAutoSaveReturn {
  savedContent: string | null;
  additionalFields: Record<string, any> | null;
  hasDraft: boolean;
  saveDraft: (content: string, additionalFields?: Record<string, any>) => void;
  clearDraft: () => void;
  lastSavedAt: Date | null;
}

const DRAFT_PREFIX = 'draft_';

export function useDraftAutoSave({
  key,
  debounceMs = 500,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
}: UseDraftAutoSaveOptions): UseDraftAutoSaveReturn {
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [additionalFields, setAdditionalFields] = useState<Record<string, any> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = `${DRAFT_PREFIX}${key}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: DraftData = JSON.parse(stored);
        const now = Date.now();
        if (now - draft.savedAt < maxAgeMs && draft.content) {
          setSavedContent(draft.content);
          setAdditionalFields(draft.additionalFields || null);
          setLastSavedAt(new Date(draft.savedAt));
          setHasDraft(true);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, maxAgeMs]);

  const saveDraft = useCallback((content: string, additionalFieldsData?: Record<string, any>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        if (!content || content.trim() === '' || content === '<p></p>') {
          localStorage.removeItem(storageKey);
          setSavedContent(null);
          setAdditionalFields(null);
          setLastSavedAt(null);
          setHasDraft(false);
          return;
        }

        const draft: DraftData = {
          content,
          savedAt: Date.now(),
          additionalFields: additionalFieldsData,
        };
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedContent(content);
        setAdditionalFields(additionalFieldsData || null);
        setLastSavedAt(new Date());
        setHasDraft(true);
      } catch {
        // localStorage might be full or disabled
      }
    }, debounceMs);
  }, [storageKey, debounceMs]);

  const clearDraft = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore errors
    }
    setSavedContent(null);
    setAdditionalFields(null);
    setLastSavedAt(null);
    setHasDraft(false);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    savedContent,
    additionalFields,
    hasDraft,
    saveDraft,
    clearDraft,
    lastSavedAt,
  };
}
