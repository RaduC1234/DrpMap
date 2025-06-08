import { Injectable } from '@angular/core';
import { FormattedContent } from '../models/quiz.models';

@Injectable({
    providedIn: 'root'
})
export class TextFormatterService {

    formatQuestionText(text: string): FormattedContent[] {
        if (!text) return [{ type: 'text', content: '' }];

        const parts: FormattedContent[] = [];
        let currentIndex = 0;

        const codeBlockRegex = /(`{3,})\s*(\w+)?\s*\r?\n([\s\S]*?)\r?\n\s*\1/g;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            if (match.index > currentIndex) {
                const textBefore = text.substring(currentIndex, match.index);
                if (textBefore.trim()) {
                    parts.push({
                        type: 'text',
                        content: this.processBasicMarkdown(textBefore)
                    });
                }
            }

            let code = match[3];
            const language = match[2] || 'csharp';
            code = this.cleanupCodeBlock(code);

            parts.push({
                type: 'code',
                content: code,
                language: language.toLowerCase()
            });

            currentIndex = match.index + match[0].length;
        }

        if (currentIndex < text.length) {
            const remainingText = text.substring(currentIndex);
            if (remainingText.trim()) {
                parts.push({
                    type: 'text',
                    content: this.processBasicMarkdown(remainingText)
                });
            }
        }

        if (parts.length === 0) {
            parts.push({
                type: 'text',
                content: this.processBasicMarkdown(text)
            });
        }

        return parts;
    }

    formatAnswerText(key: string, text: string): string {
        if (!text) return '';

        const fullText = `${key.toUpperCase()}) ${text}`;
        let formatted = fullText;

        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    private cleanupCodeBlock(code: string): string {
        if (!code) return '';

        let lines = code.split('\n');

        while (lines.length > 0 && lines[0].trim() === '') {
            lines.shift();
        }
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
        }

        if (lines.length === 0) return '';

        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        if (nonEmptyLines.length === 0) return '';

        const indentations = nonEmptyLines.map(line => {
            const match = line.match(/^(\s*)/);
            return match ? match[1].length : 0;
        });

        const minIndent = Math.min(...indentations);

        const normalizedLines = lines.map(line => {
            if (line.trim() === '') {
                return '';
            }

            const actualIndent = line.match(/^(\s*)/)?.[1].length || 0;
            const newIndent = Math.max(0, actualIndent - minIndent);
            const spaces = ' '.repeat(newIndent);
            const content = line.substring(actualIndent);

            return spaces + content;
        });

        return normalizedLines.join('\n');
    }

    private processBasicMarkdown(text: string): string {
        let processed = text;

        // Headers
        processed = processed.replace(/^### (.*$)/gm, '<h3 class="markdown-h3">$1</h3>');
        processed = processed.replace(/^## (.*$)/gm, '<h2 class="markdown-h2">$1</h2>');
        processed = processed.replace(/^# (.*$)/gm, '<h1 class="markdown-h1">$1</h1>');

        // Bold and italic
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        processed = processed.replace(/__(.*?)__/g, '<strong>$1</strong>');
        processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        processed = processed.replace(/_(.*?)_/g, '<em>$1</em>');

        // Links
        processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="markdown-link">$1</a>');

        // Inline code
        processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Blockquotes
        processed = processed.replace(/^> (.+)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>');

        // Lists
        processed = processed.replace(/^\* (.+)$/gm, '<li class="markdown-li">$1</li>');
        processed = processed.replace(/^- (.+)$/gm, '<li class="markdown-li">$1</li>');
        processed = processed.replace(/(<li class="markdown-li">.*<\/li>)(\s*<li class="markdown-li">.*<\/li>)*/g, (match) => {
            return `<ul class="markdown-ul">${match}</ul>`;
        });

        // Ordered lists
        processed = processed.replace(/^\d+\. (.+)$/gm, '<li class="markdown-ol-li">$1</li>');
        processed = processed.replace(/(<li class="markdown-ol-li">.*<\/li>)(\s*<li class="markdown-ol-li">.*<\/li>)*/g, (match) => {
            return `<ol class="markdown-ol">${match}</ol>`;
        });

        // Line breaks
        processed = processed.replace(/\n\n/g, '</p><p class="markdown-p">');
        processed = processed.replace(/\n/g, '<br>');

        // Wrap in paragraph if needed
        if (!processed.match(/^<(h[1-6]|div|ul|ol|blockquote|p)/)) {
            processed = `<p class="markdown-p">${processed}</p>`;
        }

        return processed;
    }
}