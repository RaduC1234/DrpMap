import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHighlightOptions } from 'ngx-highlightjs';

bootstrapApplication(AppComponent, {
    providers: [
        provideHttpClient(),
        provideHighlightOptions({
            fullLibraryLoader: () => import('highlight.js'),
            themePath: 'node_modules/highlight.js/styles/vs2015.css'
        })
    ]
}).catch(err => console.error(err));