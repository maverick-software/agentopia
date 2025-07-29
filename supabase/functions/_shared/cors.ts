const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://agentopia.netlify.app'
];

export const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
  'Vary': 'Origin'
}); 