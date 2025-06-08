import { Injectable } from '@angular/core';
import { getAnalytics, logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AnalyticsService {
    private analytics: any;
    private deviceId: string;

    constructor() {
        this.initializeFirebase();
        this.deviceId = this.generateDeviceId();

        // Force immediate event sending
        if (!environment.production && this.analytics) {
            (window as any).gtag('config', environment.firebase.measurementId, {
                debug_mode: true,
                send_page_view: true
            });
        }
    }

    private initializeFirebase(): void {
        try {
            const app = initializeApp(environment.firebase);
            this.analytics = getAnalytics(app);
            console.log('Firebase Analytics initialized');
        } catch (error) {
            console.error('Firebase initialization error:', error);
        }
    }

    private generateDeviceId(): string {
        // Check if device ID exists in localStorage
        let deviceId = localStorage.getItem('quiz_device_id');

        if (!deviceId) {
            // Generate unique device ID
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('quiz_device_id', deviceId);
        }

        return deviceId;
    }

    // Track unique device visit
    trackDeviceVisit(): void {
        if (!this.analytics) return;

        try {
            // Set user ID for unique device tracking
            setUserId(this.analytics, this.deviceId);

            // Set device properties
            setUserProperties(this.analytics, {
                device_type: this.getDeviceType(),
                browser: this.getBrowser(),
                first_visit: localStorage.getItem('quiz_first_visit') || new Date().toISOString()
            });

            // Log visit event
            logEvent(this.analytics, 'page_view', {
                page_title: 'Quiz App',
                page_location: window.location.href,
                device_id: this.deviceId
            });

            // Set first visit timestamp if not exists
            if (!localStorage.getItem('quiz_first_visit')) {
                localStorage.setItem('quiz_first_visit', new Date().toISOString());
            }

            console.log('Device visit tracked:', this.deviceId);
        } catch (error) {
            console.error('Analytics tracking error:', error);
        }
    }

    // Track quiz start
    trackQuizStart(): void {
        if (!this.analytics) return;

        logEvent(this.analytics, 'quiz_start', {
            device_id: this.deviceId,
            timestamp: new Date().toISOString()
        });
    }

    // Track quiz completion
    trackQuizComplete(score: number, totalQuestions: number, timeSpent: number): void {
        if (!this.analytics) return;

        const percentage = Math.round((score / totalQuestions) * 100);

        logEvent(this.analytics, 'quiz_complete', {
            device_id: this.deviceId,
            score: score,
            total_questions: totalQuestions,
            percentage: percentage,
            time_spent_seconds: timeSpent,
            timestamp: new Date().toISOString()
        });
    }

    // Track question answered
    trackQuestionAnswered(questionId: number, isCorrect: boolean, timeSpent: number): void {
        if (!this.analytics) return;

        logEvent(this.analytics, 'question_answered', {
            device_id: this.deviceId,
            question_id: questionId,
            is_correct: isCorrect,
            time_spent_seconds: timeSpent,
            timestamp: new Date().toISOString()
        });
    }

    // Track quiz abandoned
    trackQuizAbandoned(questionsAnswered: number): void {
        if (!this.analytics) return;

        logEvent(this.analytics, 'quiz_abandoned', {
            device_id: this.deviceId,
            questions_answered: questionsAnswered,
            timestamp: new Date().toISOString()
        });
    }

    // Utility methods
    private getDeviceType(): string {
        const userAgent = navigator.userAgent;

        if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
            return 'tablet';
        }
        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
            return 'mobile';
        }
        return 'desktop';
    }

    private getBrowser(): string {
        const userAgent = navigator.userAgent;

        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        return 'Other';
    }

    // Get device statistics
    getDeviceStats(): any {
        return {
            deviceId: this.deviceId,
            deviceType: this.getDeviceType(),
            browser: this.getBrowser(),
            firstVisit: localStorage.getItem('quiz_first_visit'),
            visitCount: this.getVisitCount()
        };
    }

    private getVisitCount(): number {
        const count = localStorage.getItem('quiz_visit_count');
        const newCount = count ? parseInt(count) + 1 : 1;
        localStorage.setItem('quiz_visit_count', newCount.toString());
        return newCount;
    }
}