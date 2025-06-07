import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { HighlightModule } from 'ngx-highlightjs';
import * as XLSX from 'xlsx';

interface Question {
    id: number;
    question: string;
    answers: {
        a: string;
        b: string;
        c: string;
        d: string;
    };
    correct: string[];
}

interface ExcelRow {
    Intrebare: string;
    a: string;
    b: string;
    c: string;
    d: string;
    Raspuns_corect: string;
}

interface FormattedContent {
    type: 'text' | 'code';
    content: string;
    language?: string;
}

type ViewState = 'start' | 'loading' | 'quiz' | 'results';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule, HighlightModule],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent {
    title = 'DrpMap';

    // State management
    currentView: ViewState = 'start';
    questions: Question[] = [];
    currentQuestionIndex = 0;
    score = 0;
    questionsAnswered = 0;
    selectedAnswers: string[] = [];
    hasAnswered = false;
    lastAnswerCorrect = false;

    constructor(private http: HttpClient) {}

    // Start quiz method - EXCEL ONLY
    async startQuiz(): Promise<void> {
        this.currentView = 'loading';

        try {
            console.log('Loading Excel file: Questions.xlsx');
            const data = await this.loadExcelFileOnly();
            console.log('Excel loaded, processing questions...');
            const allQuestions = this.processQuestions(data);
            console.log(`Processed ${allQuestions.length} questions`);

            this.questions = this.selectRandomQuestions(allQuestions, Math.min(37, allQuestions.length));
            this.beginQuiz();
        } catch (error) {
            console.error('Excel loading failed:', error);
            alert(`Failed to load Excel file:\n\n${(error as Error).message}\n\nMake sure Questions.xlsx is in public/ folder and restart ng serve`);
            this.currentView = 'start';
        }
    }

    private loadExcelFileOnly(): Promise<ExcelRow[]> {
        return new Promise((resolve, reject) => {
            // Try both paths - assets (after conversion) and public (direct)
            const paths = [
                'assets/questions.json',  // After running convert-excel
                'Questions.xlsx'          // Direct from public folder
            ];

            this.tryJsonThenExcel(paths, 0, resolve, reject);
        });
    }

    private tryJsonThenExcel(paths: string[], index: number, resolve: Function, reject: Function): void {
        if (index >= paths.length) {
            reject(new Error('No questions file found. Please run: npm run convert-excel'));
            return;
        }

        const currentPath = paths[index];
        console.log(`Trying path ${index + 1}/${paths.length}: ${currentPath}`);

        if (currentPath.endsWith('.json')) {
            // Try loading JSON
            this.http.get(currentPath)
                .subscribe({
                    next: (jsonData: any) => {
                        console.log(`✅ JSON loaded from ${currentPath}: ${jsonData.length} questions`);
                        resolve(jsonData as ExcelRow[]);
                    },
                    error: () => {
                        console.log(`❌ JSON not found at ${currentPath}, trying next...`);
                        this.tryJsonThenExcel(paths, index + 1, resolve, reject);
                    }
                });
        } else {
            // Try loading Excel
            this.http.get(currentPath, { responseType: 'arraybuffer' })
                .subscribe({
                    next: (data: ArrayBuffer) => {
                        console.log(`✅ Excel loaded from ${currentPath}: ${data.byteLength} bytes`);

                        try {
                            const workbook = XLSX.read(data, { type: 'array' });
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                            console.log(`✅ Extracted ${jsonData.length} rows from Excel`);
                            resolve(jsonData as ExcelRow[]);
                        } catch (err) {
                            reject(new Error(`Excel parsing error: ${err}`));
                        }
                    },
                    error: () => {
                        console.log(`❌ Excel not found at ${currentPath}, trying next...`);
                        this.tryJsonThenExcel(paths, index + 1, resolve, reject);
                    }
                });
        }
    }

    private processQuestions(data: ExcelRow[]): Question[] {
        return data.map((row: ExcelRow, index: number) => {
            try {
                let correctAnswers: string[];

                // Handle the correct answers format like ['a', 'b'] or ["a"]
                if (typeof row.Raspuns_corect === 'string') {
                    correctAnswers = JSON.parse(row.Raspuns_corect.replace(/'/g, '"'));
                } else {
                    correctAnswers = [row.Raspuns_corect];
                }

                return {
                    id: index,
                    question: row.Intrebare || '',
                    answers: {
                        a: row.a || '',
                        b: row.b || '',
                        c: row.c || '',
                        d: row.d || ''
                    },
                    correct: correctAnswers
                };
            } catch (error) {
                console.warn(`Error processing question ${index + 1}:`, error);
                return null;
            }
        }).filter((q): q is Question => q !== null && q.question.trim() !== '');
    }

    private selectRandomQuestions(allQuestions: Question[], count: number): Question[] {
        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    private beginQuiz(): void {
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.questionsAnswered = 0;
        this.currentView = 'quiz';
        this.resetQuestion();
    }

    formatQuestionText(text: string): FormattedContent[] {
        if (!text) return [{ type: 'text', content: '' }];

        console.log('Original text:', text);

        const parts: FormattedContent[] = [];
        let currentIndex = 0;

        // Enhanced regex - more careful with whitespace handling
        const codeBlockRegex = /(`{3,})\s*(\w+)?\s*\r?\n([\s\S]*?)\r?\n\s*\1/g;
        let match;

        while ((match = codeBlockRegex.exec(text)) !== null) {
            // Add text before code block
            if (match.index > currentIndex) {
                const textBefore = text.substring(currentIndex, match.index);
                if (textBefore.trim()) {
                    parts.push({
                        type: 'text',
                        content: this.processBasicMarkdown(textBefore)
                    });
                }
            }

            // Process the code block
            let code = match[3]; // Don't trim here - let cleanupCodeBlock handle it
            const language = match[2] || 'csharp';

            // Clean up the code while preserving important whitespace
            code = this.cleanupCodeBlock(code);

            console.log('Found code block:', { language, code });

            // Apply manual syntax highlighting if using manual approach
            const highlightedCode = code;

            parts.push({
                type: 'code',
                content: highlightedCode,
                language: language.toLowerCase()
            });

            currentIndex = match.index + match[0].length;
        }

        // Add remaining text after last code block
        if (currentIndex < text.length) {
            const remainingText = text.substring(currentIndex);
            if (remainingText.trim()) {
                parts.push({
                    type: 'text',
                    content: this.processBasicMarkdown(remainingText)
                });
            }
        }

        // If no code blocks found, treat entire text as text
        if (parts.length === 0) {
            parts.push({
                type: 'text',
                content: this.processBasicMarkdown(text)
            });
        }

        console.log('Formatted parts:', parts);
        return parts;
    }

// Add this new method to properly clean up code blocks
    private cleanupCodeBlock(code: string): string {
        if (!code) return '';

        console.log('Original code block:', JSON.stringify(code)); // Debug log

        // Split into lines
        let lines = code.split('\n');

        console.log('Lines before cleanup:', lines); // Debug log

        // Remove empty lines at start and end
        while (lines.length > 0 && lines[0].trim() === '') {
            lines.shift();
        }
        while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
        }

        if (lines.length === 0) return '';

        // Find the minimum indentation (excluding empty lines)
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        if (nonEmptyLines.length === 0) return '';

        // Calculate minimum indentation
        const indentations = nonEmptyLines.map(line => {
            const match = line.match(/^(\s*)/);
            return match ? match[1].length : 0;
        });

        const minIndent = Math.min(...indentations);
        console.log('Min indentation found:', minIndent); // Debug log

        // Remove the common indentation from all lines, but preserve relative indentation
        const normalizedLines = lines.map(line => {
            if (line.trim() === '') {
                return ''; // Keep empty lines empty
            }

            // Remove only the common indentation, keep the rest
            const actualIndent = line.match(/^(\s*)/)?.[1].length || 0;
            const newIndent = Math.max(0, actualIndent - minIndent);
            const spaces = ' '.repeat(newIndent);
            const content = line.substring(actualIndent);

            return spaces + content;
        });

        const result = normalizedLines.join('\n');
        console.log('Final cleaned code:', JSON.stringify(result)); // Debug log

        return result;
    }

    // Simple markdown processing (much simpler than before!)
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

    // Simple answer formatting
    formatAnswerText(key: string, text: string): string {
        if (!text) return '';

        const fullText = `${key.toUpperCase()}) ${text}`;

        // Just basic formatting for answers
        let formatted = fullText;
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    // Quiz functionality methods
    getCurrentQuestion(): Question {
        return this.questions[this.currentQuestionIndex] || {} as Question;
    }

    getAnswerEntries(): Array<{key: string, value: string}> {
        const question = this.getCurrentQuestion();
        return Object.entries(question.answers || {})
            .filter(([_, value]) => value && value.trim())
            .map(([key, value]) => ({ key, value }));
    }

    getProgress(): number {
        return (this.currentQuestionIndex / this.questions.length) * 100;
    }

    isAnswerSelected(answer: string): boolean {
        return this.selectedAnswers.includes(answer);
    }

    isCorrectAnswer(answer: string): boolean {
        const question = this.getCurrentQuestion();
        return question.correct && question.correct.includes(answer);
    }

    toggleAnswer(answer: string): void {
        if (this.hasAnswered) return;

        const index = this.selectedAnswers.indexOf(answer);
        if (index > -1) {
            this.selectedAnswers.splice(index, 1);
        } else {
            this.selectedAnswers.push(answer);
        }
    }

    submitAnswer(): void {
        if (this.hasAnswered || this.selectedAnswers.length === 0) return;

        this.hasAnswered = true;
        this.questionsAnswered++;

        const question = this.getCurrentQuestion();
        this.lastAnswerCorrect = this.arraysEqual(
            this.selectedAnswers.sort(),
            question.correct.sort()
        );

        if (this.lastAnswerCorrect) {
            this.score++;
        }
    }

    nextQuestion(): void {
        if (this.currentQuestionIndex >= this.questions.length - 1) {
            this.showResults();
        } else {
            this.currentQuestionIndex++;
            this.resetQuestion();
        }
    }

    skipQuestion(): void {
        if (!this.hasAnswered) {
            this.questionsAnswered++;
        }
        this.nextQuestion();
    }

    private resetQuestion(): void {
        this.selectedAnswers = [];
        this.hasAnswered = false;
        this.lastAnswerCorrect = false;
    }

    getCorrectAnswersText(): string {
        const question = this.getCurrentQuestion();
        return question.correct ? question.correct.map((ans: string) => ans.toUpperCase()).join(', ') : '';
    }

    // Results functionality
    private showResults(): void {
        this.currentView = 'results';
    }

    getScorePercentage(): number {
        return Math.round((this.score / this.questions.length) * 100);
    }

    getScoreCircleStyle(): { background: string } {
        const percentage = this.getScorePercentage();
        let background: string;

        if (percentage >= 80) {
            background = 'linear-gradient(135deg, #28a745, #20c997)';
        } else if (percentage >= 60) {
            background = 'linear-gradient(135deg, #ffc107, #fd7e14)';
        } else {
            background = 'linear-gradient(135deg, #dc3545, #e83e8c)';
        }

        return { background };
    }

    getPerformanceText(): string {
        const percentage = this.getScorePercentage();

        if (percentage >= 80) {
            return 'Excellent work! 🌟';
        } else if (percentage >= 60) {
            return 'Good job! 👍';
        } else {
            return 'Keep practicing! 💪';
        }
    }

    restartQuiz(): void {
        this.currentView = 'start';
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.questionsAnswered = 0;
        this.resetQuestion();
    }

    // Utility methods
    private arraysEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every(val => b.includes(val));
    }
}