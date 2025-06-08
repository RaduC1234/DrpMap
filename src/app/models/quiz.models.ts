export interface Question {
    id: number;
    question: string;
    answers: {
        a: string;
        b: string;
        c: string;
        d: string;
        e?: string;
        f?: string;
        g?: string;
        h?: string;
    };
    correct: string[];
}

export interface ExcelRow {
    Intrebare: string;
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
    f?: string;
    g?: string;
    h?: string;
    Raspuns_corect: string;
}

export interface FormattedContent {
    type: 'text' | 'code';
    content: string;
    language?: string;
}

export type ViewState = 'start' | 'loading' | 'quiz' | 'results';

export interface QuizState {
    currentView: ViewState;
    allQuestions: Question[];
    currentQuestion: Question | null;
    usedQuestionIds: Set<number>;
    score: number;
    questionsAnswered: number;
    selectedAnswers: string[];
    hasAnswered: boolean;
    lastAnswerCorrect: boolean;
}