import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HighlightModule } from 'ngx-highlightjs';
import { Subject, takeUntil } from 'rxjs';

import { QuizService } from './services/quiz.service';
import { TextFormatterService } from './services/text-formater.service';
import { AnalyticsService } from './services/analytics.service';
import { Question, QuizState, FormattedContent } from './models/quiz.models';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule, HighlightModule],
    templateUrl: './app.component.html',
    styleUrls: ['./styles/app.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, OnDestroy {
    title = 'DrpMap';

    quizState!: QuizState;
    private destroy$ = new Subject<void>();

    constructor(
        private quizService: QuizService,
        private textFormatter: TextFormatterService,
        private analytics: AnalyticsService
    ) {}

    ngOnInit(): void {
        // Track device visit when app loads
        this.analytics.trackDeviceVisit();

        this.quizService.quizState$
            .pipe(takeUntil(this.destroy$))
            .subscribe(state => {
                this.quizState = state;
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // Quiz actions
    async startQuiz(): Promise<void> {
        try {
            await this.quizService.startQuiz();
        } catch (error) {
            alert(`Failed to load Excel file:\n\n${(error as Error).message}\n\nMake sure Questions.xlsx is in public/ folder and restart ng serve`);
        }
    }

    submitAnswer(): void {
        this.quizService.submitAnswer();
    }

    nextQuestion(): void {
        this.quizService.nextQuestion();
    }

    skipQuestion(): void {
        this.quizService.skipQuestion();
    }

    toggleAnswer(answer: string): void {
        this.quizService.toggleAnswer(answer);
    }

    restartQuiz(): void {
        this.quizService.restartQuiz();
    }

    // Formatting methods
    formatQuestionText(text: string): FormattedContent[] {
        return this.textFormatter.formatQuestionText(text);
    }

    formatAnswerText(key: string, text: string): string {
        return this.textFormatter.formatAnswerText(key, text);
    }

    // Utility methods
    getCurrentQuestion(): Question {
        return this.quizState.currentQuestion || {} as Question;
    }

    getAnswerEntries(): Array<{key: string, value: string}> {
        const question = this.getCurrentQuestion();
        const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

        return answerKeys
            .map(key => ({ key, value: (question.answers as any)?.[key] || '' }))
            .filter(answer => answer.value && answer.value.trim() !== '');
    }

    getProgress(): number {
        return this.quizService.getProgress();
    }

    isAnswerSelected(answer: string): boolean {
        return this.quizState.selectedAnswers.includes(answer);
    }

    isCorrectAnswer(answer: string): boolean {
        const question = this.getCurrentQuestion();
        return question.correct && question.correct.includes(answer);
    }

    getCorrectAnswersText(): string {
        const question = this.getCurrentQuestion();
        return question.correct ? question.correct.map((ans: string) => ans.toUpperCase()).join(', ') : '';
    }

    getScorePercentage(): number {
        return this.quizService.getScorePercentage();
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
}