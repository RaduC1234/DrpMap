import {Component, OnInit, OnDestroy, ViewEncapsulation} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { QuizService } from './services/quiz.service';
import { AnalyticsService } from './services/analytics.service';
import { ThemeService } from './services/theme.service';
import { TextFormatterService } from './services/text-formater.service';
import { QUIZ_CATEGORIES, QuizCategory } from './quiz-configuration';
import { Question, FormattedContent } from './models/quiz.models';
import {HighlightModule} from "ngx-highlightjs";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, FormsModule, HighlightModule],
    templateUrl: './app.component.html',
    styleUrls: ['./styles/app.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit, OnDestroy {
    title = 'Quiz App';

    // Subject selection properties
    availableCategories = QUIZ_CATEGORIES;
    selectedCategory: QuizCategory | null = null;

    // Debug mode
    private titleClickCount = 0;
    private titleClickTimer: any;
    goToQuestionNumber: number = 1;

    // Theme
    isDarkTheme = false;

    // Subscriptions
    private quizSubscription?: Subscription;
    private themeSubscription?: Subscription;

    constructor(
        private quizService: QuizService,
        private analytics: AnalyticsService,
        private themeService: ThemeService,
        private textFormatter: TextFormatterService
    ) {}

    ngOnInit(): void {
        // Subscribe to quiz state
        this.quizSubscription = this.quizService.quizState$.subscribe(state => {
            // Update selected category from service
            this.selectedCategory = state.selectedCategory || null;
        });

        // Subscribe to theme changes
        this.themeSubscription = this.themeService.isDarkTheme$.subscribe(
            isDark => this.isDarkTheme = isDark
        );

        // Track device visit
        this.analytics.trackDeviceVisit();
    }

    ngOnDestroy(): void {
        this.quizSubscription?.unsubscribe();
        this.themeSubscription?.unsubscribe();
    }

    // Subject Selection Methods
    selectSubject(category: QuizCategory): void {
        this.selectedCategory = category;
        this.quizService.selectCategory(category);
        console.log(`Selected subject: ${category.name}`);
    }

    clearSelection(): void {
        this.selectedCategory = null;
        this.quizService.clearCategorySelection();
    }

    getSubjectStats(categoryId: string): any {
        return this.quizService.getCategoryStats(categoryId);
    }

    // Quiz Control Methods
    async startQuiz(): Promise<void> {
        if (!this.selectedCategory) {
            console.error('No subject selected');
            alert('Please select a subject first!');
            return;
        }

        try {
            await this.quizService.startQuiz();
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert('Error loading quiz questions. Please check that the data files are available and try again.');
        }
    }

    submitAnswer(): void {
        this.quizService.submitAnswer();
    }

    nextQuestion(): void {
        this.quizService.nextQuestion();
    }

    previousQuestion(): void {
        this.quizService.previousQuestion();
    }

    skipQuestion(): void {
        this.quizService.skipQuestion();
    }

    toggleAnswer(answer: string): void {
        this.quizService.toggleAnswer(answer);
    }

    restartQuiz(): void {
        this.quizService.restartQuiz();
        this.selectedCategory = null;
    }

    // State Getters
    get quizState() {
        return this.quizService.currentState;
    }

    getCurrentQuestion(): Question | null {
        return this.quizService.currentState.currentQuestion;
    }

    getProgress(): number {
        return this.quizService.getProgress();
    }

    getScorePercentage(): number {
        return this.quizService.getScorePercentage();
    }

    getScoreCircleStyle(): any {
        const percentage = this.getScorePercentage();
        let color = '#dc3545'; // Red for low scores

        if (percentage >= 80) color = '#28a745'; // Green for high scores
        else if (percentage >= 60) color = '#ffc107'; // Yellow for medium scores

        return { 'background-color': color };
    }

    getPerformanceText(): string {
        const percentage = this.getScorePercentage();
        const categoryName = this.selectedCategory?.name || 'this subject';

        if (percentage >= 90) return `Excellent work on ${categoryName}! You're a true expert! 🏆`;
        if (percentage >= 80) return `Great job on ${categoryName}! You really know your stuff! 🎉`;
        if (percentage >= 70) return `Good work on ${categoryName}! Keep studying to improve further. 👍`;
        if (percentage >= 60) return `Not bad on ${categoryName}, but there's room for improvement. 📚`;
        return `Keep studying ${categoryName} - practice makes perfect! 💪`;
    }

    // Answer Management
    isAnswerSelected(answer: string): boolean {
        return this.quizState.selectedAnswers.includes(answer);
    }

    getAnswerEntries(): Array<{key: string, value: string}> {
        const question = this.getCurrentQuestion();
        if (!question) return [];

        return Object.entries(question.answers)
            .filter(([key, value]) => value && value.trim() !== '')
            .map(([key, value]) => ({ key, value }));
    }

    getAnswerButtonClass(answerKey: string): string {
        const isSelected = this.isAnswerSelected(answerKey);
        const hasAnswered = this.quizState.hasAnswered;
        const isCorrect = this.isCorrectAnswer(answerKey);

        if (!hasAnswered) {
            return isSelected ? 'selected' : '';
        }

        // Show results after answering (unless in debug mode)
        if (!this.isDebugMode()) {
            if (isCorrect) return 'correct';
            if (isSelected && !isCorrect) return 'incorrect';
        }

        return isSelected ? 'selected' : '';
    }

    isCorrectAnswer(answerKey: string): boolean {
        const question = this.getCurrentQuestion();
        return question ? question.correct.includes(answerKey) : false;
    }

    getCorrectAnswersText(): string {
        const question = this.getCurrentQuestion();
        if (!question) return '';

        return question.correct
            .map(key => `${key.toUpperCase()}) ${question.answers[key as keyof typeof question.answers]}`)
            .join(', ');
    }

    // Text Formatting
    formatQuestionText(text: string): FormattedContent[] {
        return this.textFormatter.formatQuestionText(text);
    }

    formatAnswerText(key: string, text: string): string {
        return this.textFormatter.formatAnswerText(key, text);
    }

    // Language Support for Code Highlighting
    normalizeLanguage(language: string): string {
        if (!language) return 'csharp';

        const lang = language.toLowerCase().trim();

        const languageMap: { [key: string]: string } = {
            'c': 'c',
            'c++': 'cpp',
            'cpp': 'cpp',
            'cxx': 'cpp',
            'cc': 'cpp',
            'c#': 'csharp',
            'csharp': 'csharp',
            'cs': 'csharp',
            'java': 'java',
            'javascript': 'javascript',
            'js': 'javascript',
            'typescript': 'typescript',
            'ts': 'typescript',
            'python': 'python',
            'py': 'python',
            'html': 'html',
            'css': 'css',
            'sql': 'sql',
            'json': 'json',
            'xml': 'xml',
            'php': 'php',
            'ruby': 'ruby',
            'go': 'go',
            'rust': 'rust',
            'swift': 'swift',
            'kotlin': 'kotlin',
            'dart': 'dart'
        };

        return languageMap[lang] || lang || 'csharp';
    }

    getLanguageDisplayName(language: string): string {
        if (!language) return 'CODE';

        const lang = language.toLowerCase().trim();

        const displayNames: { [key: string]: string } = {
            'c': 'C',
            'c++': 'C++',
            'cpp': 'C++',
            'cxx': 'C++',
            'cc': 'C++',
            'c#': 'C#',
            'csharp': 'C#',
            'cs': 'C#',
            'java': 'Java',
            'javascript': 'JavaScript',
            'js': 'JavaScript',
            'typescript': 'TypeScript',
            'ts': 'TypeScript',
            'python': 'Python',
            'py': 'Python',
            'html': 'HTML',
            'css': 'CSS',
            'sql': 'SQL',
            'json': 'JSON',
            'xml': 'XML',
            'php': 'PHP',
            'ruby': 'Ruby',
            'go': 'Go',
            'rust': 'Rust',
            'swift': 'Swift',
            'kotlin': 'Kotlin',
            'dart': 'Dart'
        };

        return displayNames[lang] || language.toUpperCase();
    }

    // Debug Mode
    onTitleClick(): void {
        this.titleClickCount++;

        if (this.titleClickTimer) {
            clearTimeout(this.titleClickTimer);
        }

        this.titleClickTimer = setTimeout(() => {
            this.titleClickCount = 0;
        }, 2000);

        if (this.titleClickCount >= 5) {
            this.toggleDebugMode();
            this.titleClickCount = 0;
        }
    }

    toggleDebugMode(): void {
        this.quizService.toggleDebugMode();
    }

    isDebugMode(): boolean {
        return this.quizService.isDebugMode();
    }

    getDebugInfo(): string {
        return this.quizService.getDebugInfo();
    }

    getTotalQuestions(): number {
        return this.quizService.getTotalQuestions();
    }

    goToQuestion(): void {
        if (this.goToQuestionNumber && this.goToQuestionNumber > 0) {
            const success = this.quizService.goToQuestion(this.goToQuestionNumber);
            if (!success) {
                alert(`Invalid question number. Please enter a number between 1 and ${this.getTotalQuestions()}`);
            }
        }
    }

    onGoToQuestionKeyPress(event: KeyboardEvent): void {
        if (event.key === 'Enter') {
            this.goToQuestion();
        }
    }

    // Theme
    toggleTheme(): void {
        this.themeService.toggleTheme();
    }

    onImageLoad(event: Event): void {
        const img = event.target as HTMLImageElement;
        console.log(`Image loaded successfully: ${img.src}`);
        img.style.opacity = '1';
    }

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        console.error(`Failed to load image: ${img.src}`);

        // Replace with error message
        const container = img.parentElement;
        if (container) {
            container.innerHTML = `
                <div class="image-error">
                    📷 Image could not be loaded
                    <br><small>File: ${img.src.split('/').pop()}</small>
                </div>
            `;
        }
    }

    // Check if current question has an image (ADD THIS)
    hasQuestionImage(): boolean {
        const question = this.getCurrentQuestion();
        return !!(question?.resource && question.resource.trim());
    }
}