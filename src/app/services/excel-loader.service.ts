import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { ExcelRow, Question } from '../models/quiz.models';
import { QuizCategory } from '../quiz-configuration'; // Import the interface

@Injectable({
    providedIn: 'root'
})
export class ExcelLoaderService {
    // Cache for loaded questions per category
    private questionCache = new Map<string, Question[]>();

    constructor(private http: HttpClient) {}

    // Updated method to load questions for a specific category
    loadQuestionsForCategory(category: QuizCategory): Promise<Question[]> {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (this.questionCache.has(category.id)) {
                console.log(`Loading ${category.name} questions from cache`);
                resolve(this.questionCache.get(category.id)!);
                return;
            }

            // Try loading from different paths
            const paths = [
                `assets/${category.fileName.replace('.xlsx', '.json')}`, // JSON version
                `data/${category.fileName}`, // Public folder (your setup)
                `assets/${category.fileName}` // Assets folder fallback
            ];

            this.tryLoadFromPaths(paths, 0, category, resolve, reject);
        });
    }

    // Keep the original method for backward compatibility
    loadQuestions(): Promise<Question[]> {
        console.warn('loadQuestions() is deprecated. Use loadQuestionsForCategory() instead.');
        return new Promise((resolve, reject) => {
            const paths = [
                'assets/questions.json',
                'Questions.xlsx'
            ];

            this.tryLoadFromPaths(paths, 0, null, resolve, reject);
        });
    }

    private tryLoadFromPaths(
        paths: string[],
        index: number,
        category: QuizCategory | null,
        resolve: Function,
        reject: Function
    ): void {
        if (index >= paths.length) {
            const categoryName = category ? category.name : 'default';
            const fileName = category ? category.fileName : 'questions file';
            reject(new Error(`No ${categoryName} questions file found. Please ensure ${fileName} is in the public/data/ folder.`));
            return;
        }

        const currentPath = paths[index];
        console.log(`Trying path ${index + 1}/${paths.length}: ${currentPath}`);

        if (currentPath.endsWith('.json')) {
            this.loadJsonFile(currentPath).subscribe({
                next: (data) => {
                    const questions = this.processQuestions(data);

                    // Cache the questions if we have a category
                    if (category) {
                        this.questionCache.set(category.id, questions);
                        console.log(`Cached ${questions.length} questions for ${category.name}`);
                    }

                    resolve(questions);
                },
                error: (error) => {
                    console.log(`Failed to load JSON from ${currentPath}:`, error.message);
                    this.tryLoadFromPaths(paths, index + 1, category, resolve, reject);
                }
            });
        } else {
            this.loadExcelFile(currentPath).subscribe({
                next: (data) => {
                    const questions = this.processQuestions(data);

                    // Cache the questions if we have a category
                    if (category) {
                        this.questionCache.set(category.id, questions);
                        console.log(`Cached ${questions.length} questions for ${category.name}`);
                    }

                    resolve(questions);
                },
                error: (error) => {
                    console.log(`Failed to load Excel from ${currentPath}:`, error.message);
                    this.tryLoadFromPaths(paths, index + 1, category, resolve, reject);
                }
            });
        }
    }

    private loadJsonFile(path: string): Observable<ExcelRow[]> {
        return this.http.get<ExcelRow[]>(path).pipe(
            catchError(error => {
                throw new Error(`JSON load error: ${error.message}`);
            })
        );
    }

    private loadExcelFile(path: string): Observable<ExcelRow[]> {
        return this.http.get(path, { responseType: 'arraybuffer' }).pipe(
            switchMap((data: ArrayBuffer) => {
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet) as ExcelRow[];
                    return of(jsonData);
                } catch (error) {
                    throw new Error(`Excel parsing error: ${error}`);
                }
            }),
            catchError(error => {
                throw new Error(`Excel load error: ${error.message}`);
            })
        );
    }

    private processQuestions(data: ExcelRow[]): Question[] {
        const questions = data.map((row: ExcelRow, index: number) => {
            try {
                let correctAnswers: string[];

                // Fixed: use Raspuns_corect instead of correct
                if (typeof row.Raspuns_corect === 'string') {
                    correctAnswers = JSON.parse(row.Raspuns_corect.replace(/'/g, '"'));
                } else if (Array.isArray(row.Raspuns_corect)) {
                    correctAnswers = row.Raspuns_corect;
                } else {
                    correctAnswers = [String(row.Raspuns_corect)];
                }

                const answers: Question['answers'] = {
                    a: row.a || '',
                    b: row.b || '',
                    c: row.c || '',
                    d: row.d || ''
                };

                if (row.e && row.e.trim()) answers.e = row.e;
                if (row.f && row.f.trim()) answers.f = row.f;
                if (row.g && row.g.trim()) answers.g = row.g;
                if (row.h && row.h.trim()) answers.h = row.h;

                // Process resource field
                let resourcePath: string | undefined = undefined;
                if (row.resource && row.resource.trim()) {
                    const resource = row.resource.trim();
                    if (resource.startsWith('http://') || resource.startsWith('https://')) {
                        resourcePath = resource;
                    } else {
                        resourcePath = `data/images/${resource}`;
                    }
                }

                // Create question object properly
                const question: Question = {
                    id: index,
                    question: row.Intrebare || '',
                    answers,
                    correct: correctAnswers
                };

                // Only add resource if it exists
                if (resourcePath) {
                    question.resource = resourcePath;
                }

                return question;
            } catch (error) {
                console.warn(`Error processing question ${index + 1}:`, error);
                return null;
            }
        }).filter((q): q is Question => q !== null && q.question.trim() !== '');

        console.log(`Processed ${questions.length} valid questions`);
        return questions;
    }

    // Method to clear cache (useful for development)
    clearCache(): void {
        this.questionCache.clear();
        console.log('Question cache cleared');
    }

    // Method to get cached categories
    getCachedCategories(): string[] {
        return Array.from(this.questionCache.keys());
    }
}