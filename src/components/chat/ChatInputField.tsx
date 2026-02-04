/**
 * ChatInputField Component
 *
 * A rich input field using contenteditable that supports inline chip tokens
 * within the text flow. Chips behave like single characters - caret can be
 * placed before/after them, and Backspace/Delete removes them naturally.
 */

import React, { useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
import { Cpu, Lightbulb, CircleDot, Minus, Grid3X3, Package } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChatReference, PendingReference } from '../../types/chat';
import './ChatInputField.css';

interface ChatInputFieldProps {
  pendingReferences: PendingReference[];
  onRemoveReference: (index: number) => void;
  onSend: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
}

export interface ChatInputFieldHandle {
  triggerSend: () => void;
  focus: () => void;
  hasContent: () => boolean;
}

function getReferenceIcon(reference: ChatReference): React.ReactNode {
  if (reference.type === 'wire') return <Minus size={12} />;
  if (reference.type === 'multi') return <Package size={12} />;

  const defId = reference.definitionId.toLowerCase();
  if (defId.includes('led')) return <Lightbulb size={12} />;
  if (defId.includes('arduino') || defId.includes('uno')) return <Cpu size={12} />;
  if (defId.includes('breadboard')) return <Grid3X3 size={12} />;
  return <CircleDot size={12} />;
}

function getChipColorClass(reference: ChatReference): string {
  if (reference.type === 'wire') return 'chip--wire';
  if (reference.type === 'multi') return 'chip--multi';

  const defId = reference.definitionId.toLowerCase();
  if (defId.includes('led')) return 'chip--led';
  if (defId.includes('arduino') || defId.includes('uno')) return 'chip--arduino';
  if (defId.includes('breadboard')) return 'chip--breadboard';
  if (defId.includes('resistor')) return 'chip--resistor';
  if (defId.includes('button') || defId.includes('pushbutton')) return 'chip--button';
  return 'chip--default';
}

// Generate unique key for a reference
function getReferenceKey(ref: ChatReference, index: number): string {
  if (ref.type === 'single') return ref.instanceId;
  if (ref.type === 'wire') return ref.wireId;
  return `multi-${index}`;
}

// Create chip HTML for insertion into contenteditable
function createChipHTML(reference: ChatReference, index: number, confirmed: boolean): string {
  const colorClass = getChipColorClass(reference);
  const confirmedClass = confirmed ? 'chip--confirmed' : 'chip--pending';
  const key = getReferenceKey(reference, index);
  const iconHtml = renderToStaticMarkup(getReferenceIcon(reference));

  return `<span class="inline-chip ${colorClass} ${confirmedClass}" data-chip-index="${index}" data-chip-key="${key}" contenteditable="false"><span class="chip-icon">${iconHtml}</span><span class="chip-name">${reference.displayName}</span></span>`;
}

export const ChatInputField = forwardRef<ChatInputFieldHandle, ChatInputFieldProps>(({
  pendingReferences,
  onRemoveReference,
  onSend,
  onFocus,
  onBlur,
  placeholder = 'Ask a question...',
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRefsLengthRef = useRef(0);
  // Flag to track programmatic focus (to skip confirming references)
  const isInsertingChipRef = useRef(false);

  // Get plain text content (excluding chips)
  const getTextContent = useCallback((): string => {
    if (!editorRef.current) return '';

    let text = '';

    // Iterate through child nodes of the editor
    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        // Skip chip elements entirely - don't process their children
        if (el.classList.contains('inline-chip')) {
          return;
        }
        // Process children of non-chip elements
        node.childNodes.forEach(child => processNode(child));
      }
    };

    editorRef.current.childNodes.forEach(child => processNode(child));
    return text;
  }, []);

  // Check if editor has any content
  const hasContent = useCallback((): boolean => {
    return getTextContent().trim() !== '' || pendingReferences.length > 0;
  }, [getTextContent, pendingReferences.length]);

  // Clear the editor
  const clearEditor = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  }, []);

  // Insert chip at current cursor position (without triggering focus confirmation)
  const insertChipAtCursor = useCallback((chipHtml: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Mark that we're inserting a chip programmatically
    // This prevents the focus event from confirming references
    isInsertingChipRef.current = true;

    // Just append the chip at the end without focusing
    // This avoids triggering focus events that would confirm references
    editor.innerHTML += chipHtml;

    // Clear the flag after a microtask to allow any focus events to check it
    Promise.resolve().then(() => {
      isInsertingChipRef.current = false;
    });
  }, []);

  // Sync chips when pendingReferences changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Get current chips in DOM
    const currentChips = editor.querySelectorAll('.inline-chip');
    const currentKeys = new Set(Array.from(currentChips).map(c => c.getAttribute('data-chip-key')));

    // Get expected chips
    const expectedKeys = new Set(pendingReferences.map((pr, i) => getReferenceKey(pr.reference, i)));

    // Find new chips to add
    const newRefs = pendingReferences.filter((pr, i) => {
      const key = getReferenceKey(pr.reference, i);
      return !currentKeys.has(key);
    });

    // Find chips to remove (no longer in pendingReferences)
    currentChips.forEach(chip => {
      const key = chip.getAttribute('data-chip-key');
      if (key && !expectedKeys.has(key)) {
        chip.remove();
      }
    });

    // Update confirmed state for existing chips
    currentChips.forEach(chip => {
      const indexStr = chip.getAttribute('data-chip-index');
      if (indexStr) {
        const index = parseInt(indexStr, 10);
        const pr = pendingReferences[index];
        if (pr) {
          chip.classList.toggle('chip--confirmed', pr.confirmed);
          chip.classList.toggle('chip--pending', !pr.confirmed);
        }
      }
    });

    // Add new chips at cursor (or end)
    newRefs.forEach((pr) => {
      const actualIndex = pendingReferences.indexOf(pr);
      const chipHtml = createChipHTML(pr.reference, actualIndex, pr.confirmed);
      insertChipAtCursor(chipHtml);
    });

    lastRefsLengthRef.current = pendingReferences.length;
  }, [pendingReferences, insertChipAtCursor]);

  // Handle send
  const handleSend = useCallback(() => {
    const text = getTextContent();
    onSend(text);
    clearEditor();
  }, [getTextContent, onSend, clearEditor]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    triggerSend: () => handleSend(),
    focus: () => editorRef.current?.focus(),
    hasContent,
  }), [handleSend, hasContent]);

  // Handle keydown
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Handle backspace/delete on chips
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);

      // Check if cursor is right after a chip (for Backspace)
      if (e.key === 'Backspace' && range.collapsed) {
        const node = range.startContainer;
        const offset = range.startOffset;

        // Check previous sibling
        if (node.nodeType === Node.TEXT_NODE && offset === 0) {
          const prev = node.previousSibling;
          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
            const el = prev as HTMLElement;
            if (el.classList.contains('inline-chip')) {
              e.preventDefault();
              const indexStr = el.getAttribute('data-chip-index');
              if (indexStr) {
                onRemoveReference(parseInt(indexStr, 10));
              }
              return;
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
          const el = node as HTMLElement;
          const prev = el.childNodes[offset - 1];
          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
            const prevEl = prev as HTMLElement;
            if (prevEl.classList.contains('inline-chip')) {
              e.preventDefault();
              const indexStr = prevEl.getAttribute('data-chip-index');
              if (indexStr) {
                onRemoveReference(parseInt(indexStr, 10));
              }
              return;
            }
          }
        }
      }

      // Check if cursor is right before a chip (for Delete)
      if (e.key === 'Delete' && range.collapsed) {
        const node = range.startContainer;
        const offset = range.startOffset;

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const next = el.childNodes[offset];
          if (next && next.nodeType === Node.ELEMENT_NODE) {
            const nextEl = next as HTMLElement;
            if (nextEl.classList.contains('inline-chip')) {
              e.preventDefault();
              const indexStr = nextEl.getAttribute('data-chip-index');
              if (indexStr) {
                onRemoveReference(parseInt(indexStr, 10));
              }
              return;
            }
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          const textNode = node as Text;
          if (offset === textNode.length) {
            const next = node.nextSibling;
            if (next && next.nodeType === Node.ELEMENT_NODE) {
              const nextEl = next as HTMLElement;
              if (nextEl.classList.contains('inline-chip')) {
                e.preventDefault();
                const indexStr = nextEl.getAttribute('data-chip-index');
                if (indexStr) {
                  onRemoveReference(parseInt(indexStr, 10));
                }
                return;
              }
            }
          }
        }
      }
    }
  }, [handleSend, onRemoveReference]);

  // Handle paste - strip formatting
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Show placeholder when empty
  const [isEmpty, setIsEmpty] = React.useState(true);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const hasText = editor.textContent?.trim() !== '' || editor.querySelector('.inline-chip') !== null;
    setIsEmpty(!hasText);
  }, []);

  // Wrap onFocus to skip when we're inserting chips programmatically
  const handleFocus = useCallback(() => {
    // Don't trigger focus confirmation if we're just inserting a chip
    if (isInsertingChipRef.current) {
      return;
    }
    onFocus();
  }, [onFocus]);

  useEffect(() => {
    handleInput();
  }, [pendingReferences, handleInput]);

  return (
    <div
      className="chat-input-field"
      onClick={() => editorRef.current?.focus()}
    >
      <div
        ref={editorRef}
        className={`chat-input-editor ${isEmpty ? 'is-empty' : ''}`}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={onBlur}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
      />
    </div>
  );
});

ChatInputField.displayName = 'ChatInputField';

export default ChatInputField;
