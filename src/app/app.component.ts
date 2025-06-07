import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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

type ViewState = 'start' | 'loading' | 'quiz' | 'results';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule],
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
            console.log('Loading questions from: assets/questions.json');

            this.http.get('assets/questions.json')
                .subscribe({
                    next: (jsonData: any) => {
                        console.log(`✅ JSON file loaded: ${jsonData.length} questions`);
                        console.log('✅ First question:', jsonData[0]);

                        resolve(jsonData as ExcelRow[]);
                    },
                    error: (err) => {
                        console.error('❌ Failed to load JSON file:', err);
                        reject(new Error(`Questions JSON file not found. Please run: npm run convert-excel`));
                    }
                });
        });
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