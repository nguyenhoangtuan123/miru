import type React from 'react';
import { useCallback, useRef, type RefObject } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarkdownAction =
    | 'bold'
    | 'italic'
    | 'strikethrough'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'unordered-list'
    | 'ordered-list'
    | 'task-list'
    | 'link'
    | 'image'
    | 'blockquote'
    | 'code-inline'
    | 'code-block'
    | 'horizontal-rule'
    | 'table';

type SelectionInfo = {
    start: number;
    end: number;
    text: string;
    beforeText: string;
    afterText: string;
    fullText: string;
    lineStart: number;
    lineEnd: number;
    currentLine: string;
};

// ─── Selection helpers ────────────────────────────────────────────────────────

function getSelection(textarea: HTMLTextAreaElement): SelectionInfo {
    const fullText = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = fullText.slice(start, end);
    const beforeText = fullText.slice(0, start);
    const afterText = fullText.slice(end);

    const lineStart = beforeText.lastIndexOf('\n') + 1;
    const lineEndIndex = fullText.indexOf('\n', end);
    const lineEnd = lineEndIndex === -1 ? fullText.length : lineEndIndex;
    const currentLine = fullText.slice(lineStart, lineEnd);

    return { start, end, text, beforeText, afterText, fullText, lineStart, lineEnd, currentLine };
}

function applyChange(
    textarea: HTMLTextAreaElement,
    newValue: string,
    cursorStart: number,
    cursorEnd?: number
) {
    // Use execCommand for undo support when possible, fall back to direct value set
    textarea.focus();

    // Set value via native input for React compatibility
    const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
    )?.set;

    if (nativeSetter) {
        nativeSetter.call(textarea, newValue);
    } else {
        textarea.value = newValue;
    }

    // Dispatch input event so React picks up the change
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Set cursor position
    textarea.selectionStart = cursorStart;
    textarea.selectionEnd = cursorEnd ?? cursorStart;
    textarea.focus();
}

// ─── Markdown operations ──────────────────────────────────────────────────────

function wrapSelection(
    textarea: HTMLTextAreaElement,
    wrapper: string,
    placeholder: string
) {
    const sel = getSelection(textarea);

    if (sel.text) {
        // Check if already wrapped — toggle off
        const isAlreadyWrapped =
            sel.beforeText.endsWith(wrapper) && sel.afterText.startsWith(wrapper);

        if (isAlreadyWrapped) {
            const newText =
                sel.beforeText.slice(0, -wrapper.length) +
                sel.text +
                sel.afterText.slice(wrapper.length);
            applyChange(textarea, newText, sel.start - wrapper.length, sel.end - wrapper.length);
        } else {
            const newText = sel.beforeText + wrapper + sel.text + wrapper + sel.afterText;
            applyChange(textarea, newText, sel.start + wrapper.length, sel.end + wrapper.length);
        }
    } else {
        const newText = sel.beforeText + wrapper + placeholder + wrapper + sel.afterText;
        applyChange(
            textarea,
            newText,
            sel.start + wrapper.length,
            sel.start + wrapper.length + placeholder.length
        );
    }
}

function prefixLines(
    textarea: HTMLTextAreaElement,
    prefix: string | ((index: number) => string),
    placeholder: string
) {
    const sel = getSelection(textarea);

    if (sel.text) {
        const lines = sel.text.split('\n');
        const prefixed = lines
            .map((line, i) => {
                const p = typeof prefix === 'function' ? prefix(i) : prefix;
                // Toggle off if already prefixed
                if (line.startsWith(p)) return line.slice(p.length);
                return p + line;
            })
            .join('\n');
        const newText = sel.beforeText + prefixed + sel.afterText;
        applyChange(textarea, newText, sel.start, sel.start + prefixed.length);
    } else {
        const p = typeof prefix === 'function' ? prefix(0) : prefix;
        // Check if current line already has the prefix
        const lineContent = sel.currentLine;
        if (lineContent.startsWith(p)) {
            // Toggle off
            const newLine = lineContent.slice(p.length);
            const newText =
                sel.fullText.slice(0, sel.lineStart) + newLine + sel.fullText.slice(sel.lineEnd);
            applyChange(textarea, newText, sel.start - p.length);
        } else {
            const insert = '\n' + p + placeholder;
            const newText = sel.beforeText + insert + sel.afterText;
            applyChange(
                textarea,
                newText,
                sel.start + insert.length - placeholder.length,
                sel.start + insert.length
            );
        }
    }
}

function insertBlock(textarea: HTMLTextAreaElement, block: string) {
    const sel = getSelection(textarea);
    const needsNewlineBefore = sel.start > 0 && !sel.beforeText.endsWith('\n\n');
    const prefix = needsNewlineBefore ? (sel.beforeText.endsWith('\n') ? '\n' : '\n\n') : '';
    const needsNewlineAfter = sel.end < sel.fullText.length && !sel.afterText.startsWith('\n\n');
    const suffix = needsNewlineAfter ? '\n\n' : '';

    const newText = sel.beforeText + prefix + block + suffix + sel.afterText;
    const cursorPos = sel.start + prefix.length + block.length;
    applyChange(textarea, newText, cursorPos);
}

function insertLink(textarea: HTMLTextAreaElement) {
    const sel = getSelection(textarea);

    if (sel.text) {
        // Check if selected text looks like a URL
        const isUrl = /^https?:\/\//.test(sel.text);
        if (isUrl) {
            const newText = sel.beforeText + '[liên kết](' + sel.text + ')' + sel.afterText;
            applyChange(textarea, newText, sel.start + 1, sel.start + 'liên kết'.length + 1);
        } else {
            const newText = sel.beforeText + '[' + sel.text + '](url)' + sel.afterText;
            const urlStart = sel.start + sel.text.length + 3;
            applyChange(textarea, newText, urlStart, urlStart + 3);
        }
    } else {
        const insert = '[liên kết](url)';
        const newText = sel.beforeText + insert + sel.afterText;
        applyChange(textarea, newText, sel.start + 1, sel.start + 'liên kết'.length + 1);
    }
}

function insertImage(textarea: HTMLTextAreaElement) {
    const sel = getSelection(textarea);
    const insert = '![mô tả ảnh](url)';
    const newText = sel.beforeText + insert + sel.afterText;
    applyChange(textarea, newText, sel.start + 2, sel.start + 2 + 'mô tả ảnh'.length);
}

function insertCodeBlock(textarea: HTMLTextAreaElement) {
    const sel = getSelection(textarea);
    const code = sel.text || 'code';

    const block = '```\n' + code + '\n```';
    const needsNewline = sel.start > 0 && !sel.beforeText.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';

    const newText = sel.beforeText + prefix + block + sel.afterText;
    const codeStart = sel.start + prefix.length + 4; // after ```\n
    applyChange(textarea, newText, codeStart, codeStart + code.length);
}

function insertTable(textarea: HTMLTextAreaElement) {
    const table =
        '| Cột 1 | Cột 2 | Cột 3 |\n' +
        '| ----- | ----- | ----- |\n' +
        '| Nội dung | Nội dung | Nội dung |';
    insertBlock(textarea, table);
}

// ─── Main action dispatcher ──────────────────────────────────────────────────

export function executeMarkdownAction(
    textarea: HTMLTextAreaElement,
    action: MarkdownAction
) {
    switch (action) {
        case 'bold':
            wrapSelection(textarea, '**', 'in đậm');
            break;
        case 'italic':
            wrapSelection(textarea, '*', 'in nghiêng');
            break;
        case 'strikethrough':
            wrapSelection(textarea, '~~', 'gạch ngang');
            break;
        case 'code-inline':
            wrapSelection(textarea, '`', 'code');
            break;
        case 'heading1':
            prefixLines(textarea, '# ', 'Tiêu đề');
            break;
        case 'heading2':
            prefixLines(textarea, '## ', 'Tiêu đề');
            break;
        case 'heading3':
            prefixLines(textarea, '### ', 'Tiêu đề');
            break;
        case 'unordered-list':
            prefixLines(textarea, '- ', 'mục');
            break;
        case 'ordered-list':
            prefixLines(textarea, (i) => `${i + 1}. `, 'mục');
            break;
        case 'task-list':
            prefixLines(textarea, '- [ ] ', 'việc cần làm');
            break;
        case 'blockquote':
            prefixLines(textarea, '> ', 'trích dẫn');
            break;
        case 'link':
            insertLink(textarea);
            break;
        case 'image':
            insertImage(textarea);
            break;
        case 'code-block':
            insertCodeBlock(textarea);
            break;
        case 'horizontal-rule':
            insertBlock(textarea, '---');
            break;
        case 'table':
            insertTable(textarea);
            break;
    }
}

// ─── Keyboard handler ─────────────────────────────────────────────────────────

export function handleEditorKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    onContentChange: (value: string) => void
) {
    const textarea = event.currentTarget;
    const isCtrl = event.ctrlKey || event.metaKey;

    // Ctrl shortcuts
    if (isCtrl) {
        switch (event.key.toLowerCase()) {
            case 'b':
                event.preventDefault();
                executeMarkdownAction(textarea, 'bold');
                onContentChange(textarea.value);
                return;
            case 'i':
                event.preventDefault();
                executeMarkdownAction(textarea, 'italic');
                onContentChange(textarea.value);
                return;
            case 'k':
                event.preventDefault();
                executeMarkdownAction(textarea, 'link');
                onContentChange(textarea.value);
                return;
            case 'e':
                event.preventDefault();
                executeMarkdownAction(textarea, 'code-inline');
                onContentChange(textarea.value);
                return;
            case 'd':
                event.preventDefault();
                executeMarkdownAction(textarea, 'strikethrough');
                onContentChange(textarea.value);
                return;
        }
    }

    // Tab for indentation
    if (event.key === 'Tab') {
        event.preventDefault();
        const sel = getSelection(textarea);

        if (event.shiftKey) {
            // Outdent: remove leading spaces or tab
            if (sel.text) {
                const lines = sel.text.split('\n');
                const outdented = lines
                    .map((line) => {
                        if (line.startsWith('\t')) return line.slice(1);
                        if (line.startsWith('    ')) return line.slice(4);
                        if (line.startsWith('  ')) return line.slice(2);
                        return line;
                    })
                    .join('\n');
                const newText = sel.beforeText + outdented + sel.afterText;
                applyChange(textarea, newText, sel.start, sel.start + outdented.length);
            } else {
                const lineContent = sel.currentLine;
                let trimmed = lineContent;
                if (lineContent.startsWith('\t')) trimmed = lineContent.slice(1);
                else if (lineContent.startsWith('    ')) trimmed = lineContent.slice(4);
                else if (lineContent.startsWith('  ')) trimmed = lineContent.slice(2);

                if (trimmed !== lineContent) {
                    const diff = lineContent.length - trimmed.length;
                    const newText =
                        sel.fullText.slice(0, sel.lineStart) + trimmed + sel.fullText.slice(sel.lineEnd);
                    applyChange(textarea, newText, Math.max(sel.lineStart, sel.start - diff));
                }
            }
        } else {
            // Indent
            if (sel.text) {
                const lines = sel.text.split('\n');
                const indented = lines.map((line) => '  ' + line).join('\n');
                const newText = sel.beforeText + indented + sel.afterText;
                applyChange(textarea, newText, sel.start, sel.start + indented.length);
            } else {
                const insert = '  ';
                const newText = sel.beforeText + insert + sel.afterText;
                applyChange(textarea, newText, sel.start + insert.length);
            }
        }
        onContentChange(textarea.value);
        return;
    }

    // Enter: auto-continue lists
    if (event.key === 'Enter' && !isCtrl && !event.shiftKey) {
        const sel = getSelection(textarea);
        const lineContent = sel.currentLine;

        // Match list patterns
        const unorderedMatch = lineContent.match(/^(\s*)([-*+])\s/);
        const orderedMatch = lineContent.match(/^(\s*)(\d+)\.\s/);
        const taskMatch = lineContent.match(/^(\s*)- \[([ x])\]\s/);

        let continuation = '';

        if (taskMatch) {
            const indent = taskMatch[1];
            // If line is empty (just the marker), clear marker instead of continuing
            const contentAfterMarker = lineContent.slice(taskMatch[0].length).trim();
            if (!contentAfterMarker) {
                // Clear the empty list item
                event.preventDefault();
                const newText =
                    sel.fullText.slice(0, sel.lineStart) + '\n' + sel.fullText.slice(sel.lineEnd);
                applyChange(textarea, newText, sel.lineStart + 1);
                onContentChange(textarea.value);
                return;
            }
            continuation = indent + '- [ ] ';
        } else if (unorderedMatch) {
            const indent = unorderedMatch[1];
            const bullet = unorderedMatch[2];
            const contentAfterMarker = lineContent.slice(unorderedMatch[0].length).trim();
            if (!contentAfterMarker) {
                event.preventDefault();
                const newText =
                    sel.fullText.slice(0, sel.lineStart) + '\n' + sel.fullText.slice(sel.lineEnd);
                applyChange(textarea, newText, sel.lineStart + 1);
                onContentChange(textarea.value);
                return;
            }
            continuation = indent + bullet + ' ';
        } else if (orderedMatch) {
            const indent = orderedMatch[1];
            const num = parseInt(orderedMatch[2], 10);
            const contentAfterMarker = lineContent.slice(orderedMatch[0].length).trim();
            if (!contentAfterMarker) {
                event.preventDefault();
                const newText =
                    sel.fullText.slice(0, sel.lineStart) + '\n' + sel.fullText.slice(sel.lineEnd);
                applyChange(textarea, newText, sel.lineStart + 1);
                onContentChange(textarea.value);
                return;
            }
            continuation = indent + (num + 1) + '. ';
        } else if (lineContent.match(/^(\s*)>\s/)) {
            const indent = lineContent.match(/^(\s*)/)![1];
            const contentAfterMarker = lineContent.slice(lineContent.indexOf('>') + 1).trim();
            if (!contentAfterMarker) {
                event.preventDefault();
                const newText =
                    sel.fullText.slice(0, sel.lineStart) + '\n' + sel.fullText.slice(sel.lineEnd);
                applyChange(textarea, newText, sel.lineStart + 1);
                onContentChange(textarea.value);
                return;
            }
            continuation = indent + '> ';
        }

        if (continuation) {
            event.preventDefault();
            const insert = '\n' + continuation;
            const newText = sel.beforeText + insert + sel.afterText;
            applyChange(textarea, newText, sel.start + insert.length);
            onContentChange(textarea.value);
        }
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarkdownEditor(
    onContentChange: (value: string) => void
): {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    execute: (action: MarkdownAction) => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
} {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const execute = useCallback(
        (action: MarkdownAction) => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            executeMarkdownAction(textarea, action);
            onContentChange(textarea.value);
        },
        [onContentChange]
    );

    const onKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            handleEditorKeyDown(event, onContentChange);
        },
        [onContentChange]
    );

    return { textareaRef, execute, onKeyDown };
}
