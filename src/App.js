import React from 'react';
import AppLayout from './components/layout/AppLayout';
import AppProviders from './contexts/AppProviders';
import ErrorBoundary from './components/ErrorBoundary';

import './App.css';

function App() {
  return (
    <AppProviders>
      <ErrorBoundary 
        name="MainApplication" 
        title="Interface Error" 
        message="An error occurred in the user interface."
      >
        <div className="App">
          <AppLayout />
        </div>
      </ErrorBoundary>
    </AppProviders>
  );
}

export default App;
