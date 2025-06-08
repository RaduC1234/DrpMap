import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { ExcelRow, Question } from '../models/quiz.models';

@Injectable({
    providedIn: 'root'
})
export class ExcelLoaderService {

    constructor(private http: HttpClient) {}

    loadQuestions(): Promise<Question[]> {
        return new Promise((resolve, reject) => {
            const paths = [
                'assets/questions.json',
                'Questions.xlsx'
            ];

            this.tryLoadFromPaths(paths, 0, resolve, reject);
        });
    }

    private tryLoadFromPaths(paths: string[], index: number, resolve: Function, reject: Function): void {
        if (index >= paths.length) {
            reject(new Error('No questions file found. Please run: npm run convert-excel'));
            return;
        }

        const currentPath = paths[index];
        console.log(`Trying path ${index + 1}/${paths.length}: ${currentPath}`);

        if (currentPath.endsWith('.json')) {
            this.loadJsonFile(currentPath).subscribe({
                next: (data) => {
                    const questions = this.processQuestions(data);
                    resolve(questions);
                },
                error: () => {
                    this.tryLoadFromPaths(paths, index + 1, resolve, reject);
                }
            });
        } else {
            this.loadExcelFile(currentPath).subscribe({
                next: (data) => {
                    const questions = this.processQuestions(data);
                    resolve(questions);
                },
                error: () => {
                    this.tryLoadFromPaths(paths, index + 1, resolve, reject);
                }
            });
        }
    }

    private loadJsonFile(path: string): Observable<ExcelRow[]> {
        return this.http.get<ExcelRow[]>(path);
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
            })
        );
    }

    private processQuestions(data: ExcelRow[]): Question[] {
        return data.map((row: ExcelRow, index: number) => {
            try {
                let correctAnswers: string[];

                if (typeof row.Raspuns_corect === 'string') {
                    correctAnswers = JSON.parse(row.Raspuns_corect.replace(/'/g, '"'));
                } else {
                    correctAnswers = [row.Raspuns_corect];
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

                return {
                    id: index,
                    question: row.Intrebare || '',
                    answers,
                    correct: correctAnswers
                };
            } catch (error) {
                console.warn(`Error processing question ${index + 1}:`, error);
                return null;
            }
        }).filter((q): q is Question => q !== null && q.question.trim() !== '');
    }
}