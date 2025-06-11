import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Question, QuizState } from '../models/quiz.models';
import { ExcelLoaderService } from './excel-loader.service';
import { AnalyticsService } from './analytics.service';

@Injectable({
    providedIn: 'root'
})
export class QuizService {
    private readonly MAX_QUESTIONS = 37;
    private quizStartTime: number = 0;
    private questionStartTime: number = 0;

    private quizStateSubject = new BehaviorSubject<QuizState>({
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
        currentQuestionIndex: 0
    });

    public quizState$: Observable<QuizState> = this.quizStateSubject.asObservable();

    constructor(
        private excelLoader: ExcelLoaderService,
        private analytics: AnalyticsService
    ) {}

    get currentState(): QuizState {
        return this.quizStateSubject.value;
    }

    async startQuiz(): Promise<void> {
        this.updateState({ currentView: 'loading' });

        try {
            const questions = await this.excelLoader.loadQuestions();

            const newState: Partial<QuizState> = {
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

            // Track quiz start
            this.quizStartTime = Date.now();
            this.analytics.trackQuizStart();

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

        const updates: Partial<QuizState> = {
            hasAnswered: true,
            questionsAnswered: state.questionsAnswered + 1,
            lastAnswerCorrect: isCorrect,
            score: isCorrect ? state.score + 1 : state.score
        };

        this.updateState(updates);

        // Track question answered
        const timeSpent = (Date.now() - this.questionStartTime) / 1000;
        this.analytics.trackQuestionAnswered(
            state.currentQuestion!.id,
            isCorrect,
            timeSpent
        );

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

    restartQuiz(): void {
        const state = this.currentState;

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
            currentQuestionIndex: 0
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
    }

    private updateState(updates: Partial<QuizState>): void {
        const currentState = this.currentState;
        const newState = { ...currentState, ...updates };
        this.quizStateSubject.next(newState);
    }

    private arraysEqual(a: string[], b: string[]): boolean {
        return a.length === b.length && a.every(val => b.includes(val));
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

        return `Question ${(state.currentQuestionIndex || 0) + 1} of ${state.allQuestions.length} | ID: ${state.currentQuestion.id} | Correct: ${state.currentQuestion.correct.join(', ')}`;
    }

    getTotalQuestions(): number {
        return this.currentState.allQuestions.length;
    }

    getCurrentQuestionNumber(): number {
        return (this.currentState.currentQuestionIndex || 0) + 1;
    }
}