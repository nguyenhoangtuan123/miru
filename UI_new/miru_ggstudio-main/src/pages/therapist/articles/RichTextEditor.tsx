import { useCallback, useEffect, useRef, useState } from 'react';
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
    Upload,
    X,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Maximize2,
    type LucideIcon,
} from 'lucide-react';
import { uploadArticleImage } from '../../../services/articles';

// ─── Types ────────────────────────────────────────────────────────────────────

type RichTextEditorProps = {
    content: string; // markdown content
    onChange: (markdown: string) => void;
    placeholder?: string;
};

type ImageAlign = 'left' | 'center' | 'right';
type ImageSize = 'small' | 'medium' | 'full';

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

// ─── Image Insert Modal ──────────────────────────────────────────────────────

function ImageInsertModal({
    onInsert,
    onClose,
}: {
    onInsert: (url: string, alt: string, align: ImageAlign, size: ImageSize) => void;
    onClose: () => void;
}) {
    const [tab, setTab] = useState<'upload' | 'url'>('upload');
    const [url, setUrl] = useState('');
    const [alt, setAlt] = useState('');
    const [align, setAlign] = useState<ImageAlign>('center');
    const [size, setSize] = useState<ImageSize>('full');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        if (!file.type.startsWith('image/')) {
            setError('Chỉ chấp nhận file ảnh.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('File quá lớn. Giới hạn 5MB.');
            return;
        }

        // Show local preview
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(file);

        // Upload
        setUploading(true);
        try {
            const publicUrl = await uploadArticleImage(file);
            setUploadedUrl(publicUrl);
        } catch {
            setError('Upload thất bại. Thử lại.');
        } finally {
            setUploading(false);
        }
    }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
        },
        [handleFile]
    );

    const finalUrl = tab === 'upload' ? uploadedUrl : url.trim();
    const canInsert = !!finalUrl && !uploading;

    const handleInsert = () => {
        if (!finalUrl) return;
        onInsert(finalUrl, alt.trim(), align, size);
        onClose();
    };

    const alignOptions: Array<{ value: ImageAlign; icon: LucideIcon; label: string }> = [
        { value: 'left', icon: AlignLeft, label: 'Trái' },
        { value: 'center', icon: AlignCenter, label: 'Giữa' },
        { value: 'right', icon: AlignRight, label: 'Phải' },
    ];

    const sizeOptions: Array<{ value: ImageSize; label: string; desc: string }> = [
        { value: 'small', label: 'Nhỏ', desc: '40%' },
        { value: 'medium', label: 'Vừa', desc: '70%' },
        { value: 'full', label: 'Toàn bộ', desc: '100%' },
    ];

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
            <div
                className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 shadow-2xl"
                style={{ background: '#1a1a2e' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h3 className="text-base font-bold text-white">Chèn ảnh</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-1 rounded-xl bg-white/5 p-1">
                        <button
                            type="button"
                            onClick={() => setTab('upload')}
                            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === 'upload'
                                ? 'bg-miru-primary/20 text-miru-primary'
                                : 'text-white/50 hover:text-white'
                                }`}
                        >
                            <Upload size={14} className="inline mr-1.5 -mt-0.5" />
                            Tải lên
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('url')}
                            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${tab === 'url'
                                ? 'bg-miru-primary/20 text-miru-primary'
                                : 'text-white/50 hover:text-white'
                                }`}
                        >
                            <Link2 size={14} className="inline mr-1.5 -mt-0.5" />
                            Dán URL
                        </button>
                    </div>

                    {/* Upload tab */}
                    {tab === 'upload' && (
                        <div>
                            {previewUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-white/10">
                                    <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-contain bg-black/30" />
                                    {uploading && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <span className="text-sm text-white/80">Đang tải lên...</span>
                                        </div>
                                    )}
                                    {uploadedUrl && !uploading && (
                                        <div className="absolute bottom-2 right-2 rounded-full bg-green-500/80 px-2.5 py-1 text-xs font-bold text-white">
                                            ✓ Sẵn sàng
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    className={`rounded-xl border-2 border-dashed transition cursor-pointer flex flex-col items-center gap-2 py-10 ${dragOver ? 'border-miru-primary bg-miru-primary/5' : 'border-white/15 hover:border-white/30'}`}
                                    onClick={() => fileRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOver(true);
                                    }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={onDrop}
                                >
                                    <Upload size={28} className="text-white/25" />
                                    <span className="text-sm text-white/50">Kéo thả hoặc click chọn ảnh</span>
                                    <span className="text-[11px] text-white/25">JPG, PNG, WebP, GIF — max 5MB</span>
                                </div>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleFile(f);
                                }}
                            />
                            {previewUrl && (
                                <button
                                    type="button"
                                    className="mt-2 text-xs text-white/40 hover:text-white/70 transition"
                                    onClick={() => {
                                        setPreviewUrl(null);
                                        setUploadedUrl(null);
                                    }}
                                >
                                    Chọn ảnh khác
                                </button>
                            )}
                        </div>
                    )}

                    {/* URL tab */}
                    {tab === 'url' && (
                        <div>
                            <input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-miru-primary/40"
                            />
                            {url.trim() && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                                    <img src={url} alt="Preview" className="w-full max-h-40 object-contain bg-black/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Alt text */}
                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                            Mô tả ảnh (alt text)
                        </label>
                        <input
                            value={alt}
                            onChange={(e) => setAlt(e.target.value)}
                            placeholder="Ảnh minh họa..."
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-miru-primary/40"
                        />
                    </div>

                    {/* Alignment */}
                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                            Căn chỉnh
                        </label>
                        <div className="flex gap-2">
                            {alignOptions.map((opt) => {
                                const OptIcon = opt.icon;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setAlign(opt.value)}
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${align === opt.value
                                            ? 'border-miru-primary/40 bg-miru-primary/10 text-miru-primary'
                                            : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                                            }`}
                                    >
                                        <OptIcon size={14} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Size */}
                    <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
                            Kích cỡ
                        </label>
                        <div className="flex gap-2">
                            {sizeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setSize(opt.value)}
                                    className={`flex-1 rounded-lg border py-2 text-center text-xs font-medium transition ${size === opt.value
                                        ? 'border-miru-primary/40 bg-miru-primary/10 text-miru-primary'
                                        : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                                        }`}
                                >
                                    <Maximize2 size={12} className="inline mr-1 -mt-0.5" />
                                    {opt.label}
                                    <span className="ml-1 text-[10px] opacity-60">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-xs text-red-400">{error}</p>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-sm font-medium text-white/50 hover:text-white transition"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={handleInsert}
                        disabled={!canInsert}
                        className="rounded-xl bg-miru-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-miru-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Chèn ảnh
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Floating Image Toolbar ──────────────────────────────────────────────────

function ImageBubbleToolbar({
    editor,
}: {
    editor: ReturnType<typeof useEditor>;
}) {
    if (!editor) return null;

    const updateImageAttr = (key: string, value: string) => {
        const attrs = editor.getAttributes('image');
        const currentTitle = (attrs.title as string) || 'center|full';
        const [currentAlign, currentSize] = currentTitle.split('|');
        const newAlign = key === 'align' ? value : (currentAlign || 'center');
        const newSize = key === 'size' ? value : (currentSize || 'full');
        editor.chain().focus().updateAttributes('image', { title: `${newAlign}|${newSize}` }).run();
    };

    const attrs = editor.getAttributes('image');
    const title = (attrs.title as string) || 'center|full';
    const [curAlign, curSize] = title.split('|');

    const alignBtns: Array<{ value: string; icon: LucideIcon }> = [
        { value: 'left', icon: AlignLeft },
        { value: 'center', icon: AlignCenter },
        { value: 'right', icon: AlignRight },
    ];

    const sizeBtns: Array<{ value: string; label: string }> = [
        { value: 'small', label: 'S' },
        { value: 'medium', label: 'M' },
        { value: 'full', label: 'L' },
    ];

    return (
        <div
            className="flex items-center gap-1 rounded-xl border border-white/15 px-2 py-1 shadow-2xl"
            style={{ background: '#1a1a2e' }}
        >
            {alignBtns.map((btn) => {
                const BtnIcon = btn.icon;
                return (
                    <button
                        key={btn.value}
                        type="button"
                        onClick={() => updateImageAttr('align', btn.value)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${curAlign === btn.value
                            ? 'bg-miru-primary/25 text-miru-primary'
                            : 'text-white/50 hover:bg-white/10 hover:text-white'
                            }`}
                        title={`Căn ${btn.value}`}
                    >
                        <BtnIcon size={14} />
                    </button>
                );
            })}
            <div className="mx-0.5 h-5 w-px bg-white/10" />
            {sizeBtns.map((btn) => (
                <button
                    key={btn.value}
                    type="button"
                    onClick={() => updateImageAttr('size', btn.value)}
                    className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg text-xs font-bold transition ${curSize === btn.value
                        ? 'bg-miru-primary/25 text-miru-primary'
                        : 'text-white/50 hover:bg-white/10 hover:text-white'
                        }`}
                    title={btn.value === 'small' ? '40%' : btn.value === 'medium' ? '70%' : '100%'}
                >
                    {btn.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const [showImageModal, setShowImageModal] = useState(false);
    const [pasteToast, setPasteToast] = useState<string | null>(null);
    const [imageSelected, setImageSelected] = useState(false);

    const handlePasteImage = useCallback(async (file: File) => {
        setPasteToast('Đang tải ảnh...');
        try {
            const url = await uploadArticleImage(file);
            setPasteToast(null);
            return url;
        } catch {
            setPasteToast('Upload thất bại');
            setTimeout(() => setPasteToast(null), 2000);
            return null;
        }
    }, []);

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
                inline: false,
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
            handlePaste: (view, event) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (!file) return true;

                        // Async upload and insert
                        void handlePasteImage(file).then((url) => {
                            if (url && view.state) {
                                const { state, dispatch } = view;
                                const node = state.schema.nodes.image.create({
                                    src: url,
                                    title: 'center|full',
                                });
                                const tr = state.tr.replaceSelectionWith(node);
                                dispatch(tr);
                            }
                        });
                        return true;
                    }
                }
                return false;
            },
        },
        onUpdate: ({ editor: ed }) => {
            const md = getMarkdownFromEditor(ed);
            if (md) onChange(md);
        },
        onSelectionUpdate: ({ editor: ed }) => {
            setImageSelected(ed.isActive('image'));
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

    const insertImageFromModal = useCallback(
        (url: string, alt: string, align: ImageAlign, size: ImageSize) => {
            if (!editor) return;
            const cssClass = `editor-image editor-image--${align} editor-image--${size}`;
            editor
                .chain()
                .focus()
                .setImage({ src: url, alt: alt || undefined, title: `${align}|${size}` })
                .run();
            // After insertion, manually add class to the last inserted image
            // We encode align|size in the title attribute for markdown roundtrip
        },
        [editor]
    );

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
        <div className="relative rounded-[28px] border border-white/10 bg-white/[0.03] overflow-visible">
            {/* ─── Paste toast ─── */}
            {pasteToast && (
                <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white shadow-xl" style={{ background: '#1a1a2e' }}>
                    {pasteToast}
                </div>
            )}

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
                    onImage={() => setShowImageModal(true)}
                />
            </div>

            {/* ─── Editor content ─── */}
            <div className="px-6 py-4 md:px-8">
                <EditorContent editor={editor} />
            </div>

            {/* ─── Floating image toolbar (shown when image is selected) ─── */}
            {imageSelected && (
                <div className="flex justify-center px-6 pb-3 -mt-1 animate-in fade-in duration-150">
                    <ImageBubbleToolbar editor={editor} />
                </div>
            )}

            {/* ─── Image modal ─── */}
            {showImageModal && (
                <ImageInsertModal
                    onInsert={insertImageFromModal}
                    onClose={() => setShowImageModal(false)}
                />
            )}
        </div>
    );
}
