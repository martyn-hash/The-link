import { Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';

/**
 * Standard Tiptap extensions for rich text editing with table support
 * Used across all editor instances in the application
 * 
 * Note: Link and Underline are already included in StarterKit, so we don't need to import them separately
 */
export const getTiptapExtensions = (): Extensions => [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  TableKit.configure({
    resizable: true,
    HTMLAttributes: {
      class: 'tiptap-table',
    },
  }),
  TextStyle,
  Color,
];

/**
 * Common editor props configuration
 */
export const getEditorProps = () => ({
  attributes: {
    class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] px-4 py-3',
  },
});
