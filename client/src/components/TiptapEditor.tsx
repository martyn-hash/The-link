import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { getTiptapExtensions, getEditorProps } from '@/lib/tiptapSetup';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Palette,
  TableProperties,
  Trash2,
  Plus,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

const MenuButton = ({ 
  onClick, 
  active, 
  disabled,
  children, 
  title,
  preserveFocus = false,
}: { 
  onClick: () => void; 
  active?: boolean; 
  disabled?: boolean;
  children: React.ReactNode; 
  title: string;
  preserveFocus?: boolean;
}) => (
  <Button
    type="button"
    variant={active ? "secondary" : "ghost"}
    size="sm"
    {...(preserveFocus ? {
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault();
        onClick();
      }
    } : {
      onClick
    })}
    disabled={disabled}
    title={title}
    className="h-8 w-8 p-0"
  >
    {children}
  </Button>
);

const TableInsertPicker = ({ editor }: { editor: Editor }) => {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const gridSize = 6;

  const handleCellHover = (row: number, col: number) => {
    setHoveredCell({ row, col });
  };

  const handleCellClick = (row: number, col: number) => {
    console.log(`[Table Insert] Attempting to insert table: ${row + 1}x${col + 1}`);
    
    // Insert the table first, then close the popover
    const result = editor.chain().focus().insertTable({
      rows: row + 1,
      cols: col + 1,
      withHeaderRow: true,
    }).run();
    
    console.log(`[Table Insert] Insert command result:`, result);
    
    // Close the popover
    setIsOpen(false);
    setHoveredCell(null);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={editor.isActive('table') ? "secondary" : "ghost"}
          size="sm"
          title="Insert Table"
          className="h-8 w-8 p-0"
          data-testid="button-insert-table"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 z-[1000] pointer-events-auto" align="start">
        <div className="space-y-2">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${gridSize}, 20px)` }}>
            {Array.from({ length: gridSize }, (_, row) =>
              Array.from({ length: gridSize }, (_, col) => {
                const isHighlighted = hoveredCell && row <= hoveredCell.row && col <= hoveredCell.col;
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className={`w-5 h-5 border border-border cursor-pointer transition-colors pointer-events-auto ${
                      isHighlighted ? 'bg-primary' : 'bg-background hover:bg-muted'
                    }`}
                    onMouseEnter={() => handleCellHover(row, col)}
                    onClick={() => handleCellClick(row, col)}
                    aria-label={`Insert ${row + 1} x ${col + 1} table`}
                    data-testid={`table-cell-${row}-${col}`}
                  />
                );
              })
            )}
          </div>
          <div className="text-xs text-center text-muted-foreground">
            {hoveredCell ? `${hoveredCell.row + 1} × ${hoveredCell.col + 1}` : 'Select table size'}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const EditorMenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const isInTable = editor.isActive('table');

  return (
    <div className="border-b border-border bg-muted/30 p-2 flex flex-wrap gap-1">
      {/* Text formatting */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <UnderlineIcon className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </MenuButton>

      {/* Text Color */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1 min-w-[70px]"
              >
                <Palette className="h-4 w-4" />
                <span className="text-xs">Color</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Select text first, then choose a color</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent className="z-[100]">
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#000000').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#000000' }} />
              Black
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#ef4444').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#ef4444' }} />
              Red
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#f97316').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#f97316' }} />
              Orange
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#eab308').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#eab308' }} />
              Yellow
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#22c55e').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#22c55e' }} />
              Green
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#3b82f6').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#3b82f6' }} />
              Blue
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().setColor('#8b5cf6').run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#8b5cf6' }} />
              Purple
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.chain().focus().unsetColor().run()}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-muted" />
              Default
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-8" />

      {/* Headings */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </MenuButton>

      <Separator orientation="vertical" className="h-8" />

      {/* Lists */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </MenuButton>

      <Separator orientation="vertical" className="h-8" />

      {/* Link and Table */}
      <MenuButton
        onClick={setLink}
        active={editor.isActive('link')}
        title="Insert Link"
      >
        <LinkIcon className="h-4 w-4" />
      </MenuButton>
      <TableInsertPicker editor={editor} />

      {/* Table Editing Buttons - only show when in table */}
      {isInTable && (
        <>
          <Separator orientation="vertical" className="h-8" />
          
          <MenuButton
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title="Add Row Before"
            preserveFocus={true}
          >
            <Plus className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row After"
            preserveFocus={true}
          >
            <Plus className="h-4 w-4 rotate-180" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
            preserveFocus={true}
          >
            <Trash2 className="h-4 w-4" />
          </MenuButton>
          
          <Separator orientation="vertical" className="h-8" />
          
          <MenuButton
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title="Add Column Before"
            preserveFocus={true}
          >
            <Plus className="h-4 w-4 -rotate-90" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column After"
            preserveFocus={true}
          >
            <Plus className="h-4 w-4 rotate-90" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
            preserveFocus={true}
          >
            <Trash2 className="h-4 w-4" />
          </MenuButton>
          
          <Separator orientation="vertical" className="h-8" />
          
          <MenuButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
            preserveFocus={true}
          >
            <TableProperties className="h-4 w-4 text-destructive" />
          </MenuButton>
        </>
      )}

      <Separator orientation="vertical" className="h-8" />

      {/* Undo/Redo */}
      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </MenuButton>
    </div>
  );
};

export function TiptapEditor({ 
  content, 
  onChange, 
  placeholder = 'Start typing...', 
  className = '',
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: getTiptapExtensions(),
    content,
    editorProps: getEditorProps(),
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <TooltipProvider>
      <div className={`border border-border rounded-md overflow-hidden ${className}`}>
        {editable && <EditorMenuBar editor={editor} />}
        <EditorContent 
          editor={editor} 
          className="tiptap-editor"
          placeholder={placeholder}
        />
      </div>
    </TooltipProvider>
  );
}
