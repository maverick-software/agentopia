import React, { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { AppRouter } from './routing';
import { useRoutePrefetch } from './hooks/useRoutePrefetch';
// import { BrowserRouter } from 'react-router-dom';

// Rename to App and make default export
function App() {
  useRoutePrefetch();
  
  // Force dark mode on initial load
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
    // Optional: Clean up by removing the class when the component unmounts
    // return () => root.classList.remove('dark'); 
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <AuthProvider>
      <DatabaseProvider>
        <AppRouter />
      </DatabaseProvider>
    </AuthProvider>
  );
}

// Remove the old App function
// function App() { ... }

export default App; // Export the correct component