import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { AppRouter } from './routing';
import { useRoutePrefetch } from './hooks/useRoutePrefetch';
// import { BrowserRouter } from 'react-router-dom';

// Rename to App and make default export
function App() {
	useRoutePrefetch();
	
	// Light mode is now the default via CSS variables in src/index.css
	// Dark mode can be enabled by adding the 'dark' class via ThemeContext (coming next)

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


