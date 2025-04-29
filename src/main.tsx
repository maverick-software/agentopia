import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabase'; // Import the initialized client

createRoot(document.getElementById('root')!).render(
  // <StrictMode> // <-- Temporarily comment out
    <SessionContextProvider supabaseClient={supabase}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SessionContextProvider>
  // </StrictMode> // <-- Temporarily comment out
);