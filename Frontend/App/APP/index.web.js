import { AppRegistry } from 'react-native';
import React, { Suspense, lazy } from 'react';
import './src/styles/global.css';
import * as serviceWorkerRegistration from './src/serviceWorkerRegistration';

// FIX: Lazy load App to reduce initial bundle size
const App = lazy(() => import('./src/App'));

// Fallback component for lazy loading
const LoadingFallback = () => (
    React.createElement('div', {
        style: {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '16px',
            color: '#666'
        }
    }, 'Loading...')
);

// Wrap App in Suspense
const AppWithSuspense = () => (
    React.createElement(Suspense, { fallback: React.createElement(LoadingFallback) },
        React.createElement(App)
    )
);

AppRegistry.registerComponent('mobile-app', () => AppWithSuspense);
AppRegistry.runApplication('mobile-app', {
    rootTag: document.getElementById('root'),
});

// Service Worker registration removed to prevent reload loops in development.
// It can be re-added when preparing for production.
