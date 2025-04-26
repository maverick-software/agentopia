import React, { useEffect } from 'react';
import Layout from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { AppRouter } from './routing';
import { useRoutePrefetch } from './hooks/useRoutePrefetch';
// import { BrowserRouter } from 'react-router-dom';

// Wrapper component that uses the prefetch hook
const AppWithPrefetch = () => {
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
        <Layout>
          <AppRouter />
        </Layout>
      </DatabaseProvider>
    </AuthProvider>
  );
}

function App() {
  return <AppWithPrefetch />;
}

export default App;