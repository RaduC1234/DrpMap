// quiz-config.ts
export interface QuizCategory {
    id: string;
    name: string;
    description: string;
    fileName: string;
    icon: string;
    color: string;
}

export const QUIZ_CATEGORIES: QuizCategory[] = [
    {
        id: 'map',
        name: 'MAP',
        description: 'Test your knowledge with this quiz',
        fileName: 'map-questions.xlsx',
        icon: '🗺️',
        color: '#4a90e2'
    },
    {
        id: 'atp',
        name: 'ATP',
        description: 'Test your knowledge with this quiz',
        fileName: 'atp-questions.xlsx',
        icon: '💾',
        color: '#28a745'
    }
];