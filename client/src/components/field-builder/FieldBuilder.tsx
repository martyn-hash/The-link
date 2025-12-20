import { useState, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { FieldPalette } from "./FieldPalette";
import { FieldCanvas } from "./FieldCanvas";
import { FieldConfigModal } from "./FieldConfigModal";
import { BaseFieldCard } from "./FieldCard";
import { createEmptyField, getFieldTypeInfo, type FieldDefinition, type SystemFieldType } from "./types";
import { SystemFieldLibraryPicker } from "@/components/system-field-library-picker";
import type { SystemFieldLibrary } from "@shared/schema";

interface FieldBuilderProps {
  fields: FieldDefinition[];
  onFieldsChange: (fields: FieldDefinition[]) => void;
  isViewOnly?: boolean;
  allowedFieldTypes?: SystemFieldType[];
  showLibraryTab?: boolean;
  showSystemLibraryInline?: boolean;
  showExpectedValues?: boolean;
  canvasTitle?: string;
  canvasDescription?: string;
  className?: string;
}

export function FieldBuilder({
  fields,
  onFieldsChange,
  isViewOnly = false,
  allowedFieldTypes,
  showLibraryTab = true,
  showSystemLibraryInline = false,
  showExpectedValues = false,
  canvasTitle,
  canvasDescription,
  className
}: FieldBuilderProps) {
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [draggedField, setDraggedField] = useState<FieldDefinition | null>(null);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddField = useCallback((fieldType: SystemFieldType) => {
    const newField = createEmptyField(fieldType, fields.length);
    const updatedFields = [...fields, newField];
    onFieldsChange(updatedFields);
    setEditingFieldIndex(updatedFields.length - 1);
  }, [fields, onFieldsChange]);

  const handleAddLibraryField = useCallback((libraryField: SystemFieldLibrary) => {
    const mappedType = (allowedFieldTypes?.includes(libraryField.fieldType as SystemFieldType) 
      ? libraryField.fieldType 
      : allowedFieldTypes?.[0] || "short_text") as SystemFieldType;
    
    const newField: FieldDefinition = {
      tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fieldName: libraryField.fieldName,
      fieldType: mappedType,
      description: libraryField.description || "",
      isRequired: libraryField.isRequired || false,
      order: fields.length,
      options: libraryField.options || [],
      placeholder: libraryField.placeholder || "",
      libraryFieldId: libraryField.id,
    };
    
    const updatedFields = [...fields, newField];
    onFieldsChange(updatedFields);
    setLibraryPickerOpen(false);
  }, [fields, onFieldsChange, allowedFieldTypes]);

  const handleEditField = useCallback((index: number) => {
    setEditingFieldIndex(index);
  }, []);

  const handleDeleteField = useCallback((index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i }));
    onFieldsChange(updatedFields);
  }, [fields, onFieldsChange]);

  const handleSaveField = useCallback((updatedField: FieldDefinition) => {
    if (editingFieldIndex !== null) {
      const updatedFields = [...fields];
      updatedFields[editingFieldIndex] = updatedField;
      onFieldsChange(updatedFields);
      setEditingFieldIndex(null);
    }
  }, [editingFieldIndex, fields, onFieldsChange]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'field') {
      setDraggedField(active.data.current.field);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedField(null);

    if (!over) return;

    if (active.id.toString().startsWith('palette-')) {
      const fieldType = active.data.current?.type as SystemFieldType;
      handleAddField(fieldType);
      return;
    }

    if (active.id.toString().startsWith('library-')) {
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex(f => (f.id || f.tempId || `temp-${f.order}`) === active.id);
      const newIndex = fields.findIndex(f => (f.id || f.tempId || `temp-${f.order}`) === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedFields = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
        onFieldsChange(reorderedFields);
      }
    }
  }, [fields, onFieldsChange, handleAddField]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex h-full ${className || ''}`}>
        {!isViewOnly && (
          <FieldPalette
            onAddField={handleAddField}
            onOpenLibraryPicker={() => setLibraryPickerOpen(true)}
            onAddLibraryField={handleAddLibraryField}
            showLibraryTab={showLibraryTab}
            showSystemLibraryInline={showSystemLibraryInline}
            allowedFieldTypes={allowedFieldTypes}
            className="w-72 shrink-0"
          />
        )}

        <FieldCanvas
          fields={fields}
          onEditField={handleEditField}
          onDeleteField={handleDeleteField}
          isViewOnly={isViewOnly}
          title={canvasTitle}
          description={canvasDescription}
          className="flex-1"
        />
      </div>

      <FieldConfigModal
        field={editingFieldIndex !== null ? fields[editingFieldIndex] : null}
        isOpen={editingFieldIndex !== null}
        onClose={() => setEditingFieldIndex(null)}
        onSave={handleSaveField}
        isViewOnly={isViewOnly}
        allowedFieldTypes={allowedFieldTypes}
        showExpectedValues={showExpectedValues}
      />

      <SystemFieldLibraryPicker
        open={libraryPickerOpen}
        onOpenChange={setLibraryPickerOpen}
        onSelectField={handleAddLibraryField}
        allowedFieldTypes={allowedFieldTypes ? allowedFieldTypes.map(t => t as string) : undefined}
        title="Pick from System Field Library"
        description="Select a pre-defined field from your company's reusable field library"
      />

      <DragOverlay>
        {draggedField && (
          <div className="opacity-80">
            <BaseFieldCard
              field={draggedField}
              index={-1}
              onEdit={() => {}}
              onDelete={() => {}}
              showDragHandle={false}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
