import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Question, QuizState } from '../models/quiz.models';
import { QuizCategory } from '../quiz-configuration'; // Import the interface
import { ExcelLoaderService } from './excel-loader.service';
import { AnalyticsService } from './analytics.service';

// Extended QuizState interface to include category info
interface ExtendedQuizState extends QuizState {
    selectedCategory?: QuizCategory;
}

@Injectable({
    providedIn: 'root'
})
export class QuizService {
    private readonly MAX_QUESTIONS = 37;
    private quizStartTime: number = 0;
    private questionStartTime: number = 0;

    private quizStateSubject = new BehaviorSubject<ExtendedQuizState>({
        currentView: 'start',
        allQuestions: [],
        currentQuestion: null,
        usedQuestionIds: new Set(),
        score: 0,
        questionsAnswered: 0,
        selectedAnswers: [],
        hasAnswered: false,
        lastAnswerCorrect: false,
        debugMode: false,
        currentQuestionIndex: 0,
        selectedCategory: undefined
    });

    public quizState$: Observable<ExtendedQuizState> = this.quizStateSubject.asObservable();

    constructor(
        private excelLoader: ExcelLoaderService,
        private analytics: AnalyticsService
    ) {}

    get currentState(): ExtendedQuizState {
        return this.quizStateSubject.value;
    }

    // NEW: Method to select a quiz category
    selectCategory(category: QuizCategory): void {
        this.updateState({ selectedCategory: category });
        console.log(`Selected category: ${category.name}`);
    }

    // NEW: Method to clear category selection
    clearCategorySelection(): void {
        this.updateState({ selectedCategory: undefined });
        console.log('Category selection cleared');
    }

    // MODIFIED: Updated to work with selected category
    async startQuiz(): Promise<void> {
        const selectedCategory = this.currentState.selectedCategory;

        if (!selectedCategory) {
            throw new Error('No category selected. Please select a quiz category first.');
        }

        this.updateState({ currentView: 'loading' });

        try {
            console.log(`Loading questions for ${selectedCategory.name}...`);
            const questions = await this.excelLoader.loadQuestionsForCategory(selectedCategory);

            const newState: Partial<ExtendedQuizState> = {
                allQuestions: questions,
                usedQuestionIds: new Set(),
                score: 0,
                questionsAnswered: 0,
                currentView: 'quiz',
                currentQuestionIndex: 0
            };

            this.updateState(newState);

            if (this.currentState.debugMode) {
                this.loadQuestionByIndex(0);
            } else {
                this.loadRandomQuestion();
            }

            this.resetQuestion();

            // Track quiz start with category info
            this.quizStartTime = Date.now();
            this.analytics.trackQuizStart();
            console.log(`Started ${selectedCategory.name} quiz with ${questions.length} questions`);

        } catch (error) {
            console.error('Quiz loading failed:', error);
            this.updateState({ currentView: 'start' });
            throw error;
        }
    }

    loadRandomQuestion(): void {
        const state = this.currentState;
        const availableQuestions = state.allQuestions.filter(q => !state.usedQuestionIds.has(q.id));

        if (availableQuestions.length === 0) {
            this.showResults();
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const selectedQuestion = availableQuestions[randomIndex];

        console.log('Loading question, about to scramble...'); // Debug log

        // Scramble the answers for this question (unless in debug mode)
        const finalQuestion = state.debugMode ? selectedQuestion : this.scrambleAnswers(selectedQuestion);

        this.updateState({ currentQuestion: finalQuestion });

        // Track question start time
        this.questionStartTime = Date.now();
    }

    loadQuestionByIndex(index: number): void {
        const state = this.currentState;

        if (index < 0 || index >= state.allQuestions.length) {
            console.warn(`Invalid question index: ${index}. Valid range: 0-${state.allQuestions.length - 1}`);
            return;
        }

        const selectedQuestion = state.allQuestions[index];

        // In debug mode, don't scramble answers
        const finalQuestion = state.debugMode ? selectedQuestion : this.scrambleAnswers(selectedQuestion);

        this.updateState({
            currentQuestion: finalQuestion,
            currentQuestionIndex: index
        });

        // Track question start time
        this.questionStartTime = Date.now();
    }

    goToQuestion(questionNumber: number): boolean {
        const index = questionNumber - 1; // Convert 1-based to 0-based
        const state = this.currentState;

        if (!state.debugMode) {
            console.warn('Direct question navigation only available in debug mode');
            return false;
        }

        if (index < 0 || index >= state.allQuestions.length) {
            console.warn(`Invalid question number: ${questionNumber}. Valid range: 1-${state.allQuestions.length}`);
            return false;
        }

        this.loadQuestionByIndex(index);
        this.resetQuestion();
        return true;
    }

    /**
     * Scrambles the answer options while maintaining the correct answer mapping
     */
    private scrambleAnswers(question: Question): Question {
        console.log('Original question:', question); // Debug log

        // Get all available answer options
        const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const availableAnswers: Array<{key: string, value: string}> = [];

        // Collect all non-empty answers
        answerKeys.forEach(key => {
            const value = (question.answers as any)?.[key];
            if (value && value.trim() !== '') {
                availableAnswers.push({ key, value });
            }
        });

        console.log('Available answers:', availableAnswers); // Debug log

        // If we have less than 2 answers, no point in scrambling
        if (availableAnswers.length < 2) {
            console.log('Not enough answers to scramble');
            return question;
        }

        // Create arrays for shuffling
        const answerValues = availableAnswers.map(a => a.value);
        const shuffledValues = this.shuffleArray([...answerValues]);

        console.log('Original values:', answerValues);
        console.log('Shuffled values:', shuffledValues);

        // Create new answer mapping and track the remapping
        const scrambledAnswers: any = {};
        const originalToNewMapping: {[key: string]: string} = {};

        // Map shuffled values back to letters
        shuffledValues.forEach((shuffledValue, index) => {
            const newKey = answerKeys[index];
            const originalAnswer = availableAnswers.find(a => a.value === shuffledValue);

            if (originalAnswer) {
                scrambledAnswers[newKey] = shuffledValue;
                originalToNewMapping[originalAnswer.key] = newKey;
            }
        });

        console.log('Original to new mapping:', originalToNewMapping);

        // Update correct answers to match new letter assignments
        const newCorrectAnswers = question.correct.map(originalKey => {
            const newKey = originalToNewMapping[originalKey];
            console.log(`Mapping correct answer: ${originalKey} -> ${newKey}`);
            return newKey || originalKey;
        });

        console.log('Original correct answers:', question.correct);
        console.log('New correct answers:', newCorrectAnswers);

        const scrambledQuestion = {
            ...question,
            answers: scrambledAnswers,
            correct: newCorrectAnswers
        };

        console.log('Scrambled question:', scrambledQuestion);
        return scrambledQuestion;
    }

    /**
     * Fisher-Yates shuffle algorithm
     */
    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    toggleAnswer(answer: string): void {
        const state = this.currentState;
        if (state.hasAnswered) return;

        const selectedAnswers = [...state.selectedAnswers];
        const index = selectedAnswers.indexOf(answer);

        if (index > -1) {
            selectedAnswers.splice(index, 1);
        } else {
            selectedAnswers.push(answer);
        }

        this.updateState({ selectedAnswers });
    }

    submitAnswer(): void {
        const state = this.currentState;
        if (state.hasAnswered || state.selectedAnswers.length === 0) return;

        const isCorrect = this.arraysEqual(
            state.selectedAnswers.sort(),
            state.currentQuestion!.correct.sort()
        );

        const updates: Partial<ExtendedQuizState> = {
            hasAnswered: true,
            questionsAnswered: state.questionsAnswered + 1,
            lastAnswerCorrect: isCorrect,
            score: isCorrect ? state.score + 1 : state.score
        };

        this.updateState(updates);

        // Track question answered with category info
        const timeSpent = (Date.now() - this.questionStartTime) / 1000;
        this.analytics.trackQuestionAnswered(
            state.currentQuestion!.id,
            isCorrect,
            timeSpent
        );

        // Save stats for the current category
        this.saveQuestionResult(isCorrect, timeSpent);

        if (state.questionsAnswered + 1 >= this.MAX_QUESTIONS) {
            if (state.currentQuestion) {
                const newUsedIds = new Set(state.usedQuestionIds);
                newUsedIds.add(state.currentQuestion.id);
                this.updateState({ usedQuestionIds: newUsedIds });
            }
            setTimeout(() => this.showResults(), 1500);
        }
    }

    nextQuestion(): void {
        const state = this.currentState;

        if (state.currentQuestion) {
            const newUsedIds = new Set(state.usedQuestionIds);
            newUsedIds.add(state.currentQuestion.id);
            this.updateState({ usedQuestionIds: newUsedIds });
        }

        if (state.debugMode) {
            // In debug mode, go to next question in sequence
            const nextIndex = (state.currentQuestionIndex || 0) + 1;
            this.loadQuestionByIndex(nextIndex);
        } else {
            // Normal mode - check if we've reached max questions
            if (state.questionsAnswered >= this.MAX_QUESTIONS) {
                this.showResults();
                return;
            }
            this.loadRandomQuestion();
        }

        this.resetQuestion();
    }

    previousQuestion(): void {
        const state = this.currentState;

        if (!state.debugMode) return; // Only available in debug mode

        const prevIndex = Math.max(0, (state.currentQuestionIndex || 0) - 1);
        this.loadQuestionByIndex(prevIndex);
        this.resetQuestion();
    }

    skipQuestion(): void {
        if (this.currentState.debugMode) {
            // In debug mode, just go to next question
            this.nextQuestion();
        } else {
            // Normal mode - load random question
            this.loadRandomQuestion();
            this.resetQuestion();
        }
    }

    toggleDebugMode(): void {
        const state = this.currentState;
        const newDebugMode = !state.debugMode;

        console.log(`Debug mode ${newDebugMode ? 'ENABLED' : 'DISABLED'}`);

        this.updateState({
            debugMode: newDebugMode,
            currentQuestionIndex: 0
        });

        // If we're in quiz mode and toggling debug, reload current question
        if (state.currentView === 'quiz' && state.allQuestions.length > 0) {
            if (newDebugMode) {
                this.loadQuestionByIndex(0);
            } else {
                this.loadRandomQuestion();
            }
            this.resetQuestion();
        }
    }

    // MODIFIED: Updated to save category-specific stats and clear selection
    restartQuiz(): void {
        const state = this.currentState;

        // Save final quiz stats for the category
        if (state.selectedCategory) {
            this.saveFinalQuizStats();
        }

        // Track abandonment if quiz was not completed
        if (state.currentView === 'quiz' && state.questionsAnswered < this.MAX_QUESTIONS) {
            this.analytics.trackQuizAbandoned(state.questionsAnswered);
        }

        this.updateState({
            currentView: 'start',
            allQuestions: [],
            currentQuestion: null,
            usedQuestionIds: new Set(),
            score: 0,
            questionsAnswered: 0,
            selectedAnswers: [],
            hasAnswered: false,
            lastAnswerCorrect: false,
            currentQuestionIndex: 0,
            selectedCategory: undefined // Clear category selection
            // Keep debugMode state when restarting
        });
    }

    private resetQuestion(): void {
        this.updateState({
            selectedAnswers: [],
            hasAnswered: false,
            lastAnswerCorrect: false
        });
    }

    private showResults(): void {
        this.updateState({ currentView: 'results' });

        // Track quiz completion
        const state = this.currentState;
        const timeSpent = (Date.now() - this.quizStartTime) / 1000;
        this.analytics.trackQuizComplete(
            state.score,
            state.questionsAnswered,
            timeSpent
        );

        // Save final stats for the category
        this.saveFinalQuizStats();
    }

    private updateState(updates: Partial<ExtendedQuizState>): void {
        const currentState = this.currentState;
        const newState = { ...currentState, ...updates };
        this.quizStateSubject.next(newState);
    }

    private arraysEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every(val => b.includes(val));
    }

    // NEW: Save question result for category stats
    private saveQuestionResult(isCorrect: boolean, timeSpent: number): void {
        const state = this.currentState;
        if (!state.selectedCategory) return;

        const categoryId = state.selectedCategory.id;
        const stats = this.getCategoryStats(categoryId) || {};

        // Update stats
        stats.totalAttempts = (stats.totalAttempts || 0) + 1;
        stats.totalCorrect = (stats.totalCorrect || 0) + (isCorrect ? 1 : 0);
        stats.totalTimeSpent = (stats.totalTimeSpent || 0) + timeSpent;
        stats.lastActivity = new Date().toISOString();

        this.saveCategoryStats(categoryId, stats);
    }

    // NEW: Save final quiz statistics
    private saveFinalQuizStats(): void {
        const state = this.currentState;
        if (!state.selectedCategory) return;

        const categoryId = state.selectedCategory.id;
        const stats = this.getCategoryStats(categoryId) || {};

        const percentage = state.questionsAnswered > 0 ?
            Math.round((state.score / state.questionsAnswered) * 100) : 0;

        // Update quiz-level stats
        stats.totalQuizzes = (stats.totalQuizzes || 0) + 1;
        stats.lastScore = percentage;
        stats.bestScore = Math.max(stats.bestScore || 0, percentage);
        stats.totalQuestions = state.allQuestions.length;
        stats.lastCompleted = new Date().toISOString();

        this.saveCategoryStats(categoryId, stats);
        console.log(`Saved final stats for ${state.selectedCategory.name}:`, stats);
    }

    // NEW: Get category statistics
    getCategoryStats(categoryId: string): any {
        const stats = localStorage.getItem(`quiz-stats-${categoryId}`);
        return stats ? JSON.parse(stats) : null;
    }

    // NEW: Save category statistics
    private saveCategoryStats(categoryId: string, stats: any): void {
        localStorage.setItem(`quiz-stats-${categoryId}`, JSON.stringify(stats));
    }

    // Utility methods for components
    getProgress(): number {
        const state = this.currentState;
        if (state.debugMode) {
            return (((state.currentQuestionIndex || 0) + 1) / state.allQuestions.length) * 100;
        }
        return (state.questionsAnswered / this.MAX_QUESTIONS) * 100;
    }

    getScorePercentage(): number {
        const state = this.currentState;
        return state.questionsAnswered > 0 ? Math.round((state.score / state.questionsAnswered) * 100) : 0;
    }

    // Debug mode utilities
    isDebugMode(): boolean {
        return this.currentState.debugMode || false;
    }

    getDebugInfo(): string {
        const state = this.currentState;
        if (!state.debugMode || !state.currentQuestion) return '';

        const categoryInfo = state.selectedCategory ? ` | ${state.selectedCategory.name}` : '';
        return `Question ${(state.currentQuestionIndex || 0) + 1} of ${state.allQuestions.length} | ID: ${state.currentQuestion.id} | Correct: ${state.currentQuestion.correct.join(', ')}${categoryInfo}`;
    }

    getTotalQuestions(): number {
        return this.currentState.allQuestions.length;
    }

    getCurrentQuestionNumber(): number {
        return (this.currentState.currentQuestionIndex || 0) + 1;
    }

    // NEW: Get current selected category
    getSelectedCategory(): QuizCategory | undefined {
        return this.currentState.selectedCategory;
    }
}