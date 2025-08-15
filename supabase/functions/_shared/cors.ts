const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://agentopia.netlify.app'
]);

export const corsHeaders = (origin?: string) => {
  const allow = origin && allowedOrigins.has(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agentopia-service',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
    'Vary': 'Origin'
  } as Record<string, string>;
};