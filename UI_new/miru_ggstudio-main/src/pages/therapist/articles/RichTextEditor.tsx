import { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import {
    Bold,
    ChevronDown,
    Code,
    CodeSquare,
    Heading1,
    Heading2,
    Heading3,
    ImagePlus,
    Italic,
    Link2,
    List,
    ListOrdered,
    ListTodo,
    Minus,
    Quote,
    Redo2,
    Strikethrough,
    Table as TableIcon,
    Underline as UnderlineIcon,
    Undo2,
    type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RichTextEditorProps = {
    content: string; // markdown content
    onChange: (markdown: string) => void;
    placeholder?: string;
};

// ─── Helpers to get markdown from editor ──────────────────────────────────────

function getMarkdownFromEditor(editor: ReturnType<typeof useEditor>): string {
    if (!editor) return '';
    try {
        // tiptap-markdown extension attaches getMarkdown to storage
        const storage = editor.storage as unknown as Record<string, unknown>;
        const mdStorage = storage?.markdown as Record<string, unknown> | undefined;
        if (mdStorage && typeof mdStorage.getMarkdown === 'function') {
            return mdStorage.getMarkdown() as string;
        }
    } catch {
        // fallback
    }
    // Fallback: return HTML if markdown isn't available
    return editor.getHTML();
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

function ToolbarBtn({
    icon: Icon,
    label,
    shortcut,
    onClick,
    active,
    disabled,
}: {
    icon: LucideIcon;
    label: string;
    shortcut?: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={shortcut ? `${label} (${shortcut})` : label}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${active
                ? 'bg-miru-primary/20 text-miru-primary'
                : 'text-white/50 hover:bg-white/10 hover:text-white'
                } disabled:opacity-30`}
        >
            <Icon size={16} />
        </button>
    );
}

// ─── Heading dropdown ─────────────────────────────────────────────────────────

function HeadingMenu({
    onSelect,
    activeLevel,
}: {
    onSelect: (level: 1 | 2 | 3) => void;
    activeLevel: number | null;
}) {
    const [open, setOpen] = useState(false);

    const items: Array<{ level: 1 | 2 | 3; icon: LucideIcon; label: string }> = [
        { level: 1, icon: Heading1, label: 'Heading 1' },
        { level: 2, icon: Heading2, label: 'Heading 2' },
        { level: 3, icon: Heading3, label: 'Heading 3' },
    ];

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`inline-flex h-9 items-center gap-1 rounded-lg px-2 transition ${activeLevel ? 'bg-miru-primary/20 text-miru-primary' : 'text-white/50 hover:bg-white/10 hover:text-white'
                    }`}
                title="Heading"
            >
                <Heading2 size={16} />
                <ChevronDown size={12} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div style={{ background: '#ffffff', color: '#1a1a2e' }} className="absolute left-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-gray-200 p-1 shadow-2xl">
                        {items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                                <button
                                    key={item.level}
                                    type="button"
                                    onClick={() => {
                                        onSelect(item.level);
                                        setOpen(false);
                                    }}
                                    style={{ color: activeLevel === item.level ? undefined : '#333' }}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${activeLevel === item.level
                                        ? 'bg-miru-primary/10 text-miru-primary'
                                        : 'hover:bg-gray-100'
                                        }`}
                                >
                                    <ItemIcon size={15} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Insert menu ──────────────────────────────────────────────────────────────

function InsertMenu({
    onCodeBlock,
    onTable,
    onHorizontalRule,
    onTaskList,
    onImage,
}: {
    onCodeBlock: () => void;
    onTable: () => void;
    onHorizontalRule: () => void;
    onTaskList: () => void;
    onImage: () => void;
}) {
    const [open, setOpen] = useState(false);

    const items: Array<{ icon: LucideIcon; label: string; action: () => void }> = [
        { icon: CodeSquare, label: 'Khối code', action: onCodeBlock },
        { icon: TableIcon, label: 'Bảng', action: onTable },
        { icon: Minus, label: 'Đường kẻ ngang', action: onHorizontalRule },
        { icon: ListTodo, label: 'Danh sách việc', action: onTaskList },
        { icon: ImagePlus, label: 'Chèn ảnh', action: onImage },
    ];

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
                title="Chèn thêm"
            >
                <span>Chèn</span>
                <ChevronDown size={12} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div style={{ background: '#ffffff', color: '#1a1a2e' }} className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 p-1 shadow-2xl">
                        {items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => {
                                        item.action();
                                        setOpen(false);
                                    }}
                                    style={{ color: '#333' }}
                                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-gray-100"
                                >
                                    <ItemIcon size={15} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
    return <div className="mx-0.5 h-6 w-px bg-white/10" />;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: { HTMLAttributes: { class: 'editor-code-block' } },
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'editor-link' },
            }),
            Image.configure({
                HTMLAttributes: { class: 'editor-image' },
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Bắt đầu viết...',
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            Markdown.configure({
                html: false,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: 'editor-content outline-none min-h-[440px] px-1 py-2',
            },
        },
        onUpdate: ({ editor: ed }) => {
            const md = getMarkdownFromEditor(ed);
            if (md) onChange(md);
        },
    });

    // Sync external content changes (e.g. switching articles)
    // biome-ignore lint: editor dependency would cause infinite loop
    const prevContentRef = useCallback(
        (newContent: string) => {
            if (!editor) return;
            if (editor.isFocused) return;
            const currentMd = getMarkdownFromEditor(editor);
            if (currentMd === newContent) return;
            editor.commands.setContent(newContent);
        },
        [editor]
    );

    // Sync when content prop changes and editor is not focused
    // Using a simple check in a callback instead of useEffect to avoid loops
    if (editor && !editor.isFocused) {
        const currentMd = getMarkdownFromEditor(editor);
        if (currentMd !== content && content !== undefined) {
            // Use queueMicrotask to avoid updating during render
            queueMicrotask(() => {
                if (!editor.isFocused) {
                    editor.commands.setContent(content);
                }
            });
        }
    }

    const setLink = useCallback(() => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('URL liên kết:', previousUrl ?? 'https://');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    const addImage = useCallback(() => {
        if (!editor) return;
        const url = window.prompt('URL ảnh:', 'https://');
        if (!url) return;
        editor.chain().focus().setImage({ src: url }).run();
    }, [editor]);

    const insertTable = useCallback(() => {
        if (!editor) return;
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);

    if (!editor) return null;

    const activeHeading = editor.isActive('heading', { level: 1 })
        ? 1
        : editor.isActive('heading', { level: 2 })
            ? 2
            : editor.isActive('heading', { level: 3 })
                ? 3
                : null;

    return (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] overflow-visible">
            {/* ─── Toolbar ─── */}
            <div className="relative flex flex-wrap items-center gap-0.5 rounded-t-[28px] border-b border-white/10 bg-white/[0.02] px-3 py-2">
                {/* Undo / Redo */}
                <ToolbarBtn
                    icon={Undo2}
                    label="Hoàn tác"
                    shortcut="Ctrl+Z"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                />
                <ToolbarBtn
                    icon={Redo2}
                    label="Làm lại"
                    shortcut="Ctrl+Y"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                />

                <Divider />

                {/* Headings */}
                <HeadingMenu
                    activeLevel={activeHeading}
                    onSelect={(level) => editor.chain().focus().toggleHeading({ level }).run()}
                />

                <Divider />

                {/* Text formatting */}
                <ToolbarBtn
                    icon={Bold}
                    label="In đậm"
                    shortcut="Ctrl+B"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    active={editor.isActive('bold')}
                />
                <ToolbarBtn
                    icon={Italic}
                    label="In nghiêng"
                    shortcut="Ctrl+I"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    active={editor.isActive('italic')}
                />
                <ToolbarBtn
                    icon={UnderlineIcon}
                    label="Gạch chân"
                    shortcut="Ctrl+U"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    active={editor.isActive('underline')}
                />
                <ToolbarBtn
                    icon={Strikethrough}
                    label="Gạch ngang"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    active={editor.isActive('strike')}
                />
                <ToolbarBtn
                    icon={Code}
                    label="Mã nội dòng"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    active={editor.isActive('code')}
                />

                <Divider />

                {/* Lists */}
                <ToolbarBtn
                    icon={List}
                    label="Danh sách"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    active={editor.isActive('bulletList')}
                />
                <ToolbarBtn
                    icon={ListOrdered}
                    label="Danh sách số"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    active={editor.isActive('orderedList')}
                />
                <ToolbarBtn
                    icon={Quote}
                    label="Trích dẫn"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    active={editor.isActive('blockquote')}
                />

                <Divider />

                {/* Link */}
                <ToolbarBtn
                    icon={Link2}
                    label="Liên kết"
                    shortcut="Ctrl+K"
                    onClick={setLink}
                    active={editor.isActive('link')}
                />

                {/* Insert menu */}
                <InsertMenu
                    onCodeBlock={() => editor.chain().focus().toggleCodeBlock().run()}
                    onTable={insertTable}
                    onHorizontalRule={() => editor.chain().focus().setHorizontalRule().run()}
                    onTaskList={() => editor.chain().focus().toggleTaskList().run()}
                    onImage={addImage}
                />
            </div>

            {/* ─── Editor content ─── */}
            <div className="px-6 py-4 md:px-8">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
