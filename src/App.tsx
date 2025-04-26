import React from 'react';
// import { Layout } from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { AppRouter } from './routing';
import { useRoutePrefetch } from './hooks/useRoutePrefetch';
// import { BrowserRouter } from 'react-router-dom';

// Wrapper component that uses the prefetch hook
const AppWithPrefetch = () => {
  useRoutePrefetch();
  
  return (
    <AuthProvider>
      <DatabaseProvider>
        {/* <Layout> */}
          <AppRouter />
        {/* </Layout> */}
      </DatabaseProvider>
    </AuthProvider>
  );
}

function App() {
  return <AppWithPrefetch />;
}

export default App;