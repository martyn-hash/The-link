import { Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';

/**
 * Standard Tiptap extensions for rich text editing with table support
 * Used across all editor instances in the application
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
  Underline,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'text-primary underline',
    },
  }),
];

/**
 * Common editor props configuration
 */
export const getEditorProps = () => ({
  attributes: {
    class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] px-4 py-3',
  },
});
