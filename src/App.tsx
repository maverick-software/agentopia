import React from 'react';
import { Layout } from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { AppRouter } from './router/AppRouter';

function App() {
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

export default App;