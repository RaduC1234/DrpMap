import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private isDarkThemeSubject = new BehaviorSubject<boolean>(false);
    public isDarkTheme$ = this.isDarkThemeSubject.asObservable();

    constructor() {
        // Check localStorage for saved theme preference
        const savedTheme = localStorage.getItem('quiz-theme');
        if (savedTheme) {
            this.setTheme(savedTheme === 'dark');
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark);
        }
    }

    get isDarkTheme(): boolean {
        return this.isDarkThemeSubject.value;
    }

    setTheme(isDark: boolean): void {
        this.isDarkThemeSubject.next(isDark);
        localStorage.setItem('quiz-theme', isDark ? 'dark' : 'light');

        // Add/remove dark class on document body
        if (isDark) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
    }

    toggleTheme(): void {
        this.setTheme(!this.isDarkTheme);
    }
}