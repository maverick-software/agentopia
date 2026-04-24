declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export async function callDtmaApi(
  toolboxIp: string,
  method: 'POST' | 'DELETE',
  path: string,
  payload?: object
): Promise<any> {
  const dtmaPort = Deno.env.get('DTMA_PORT') || '30000';
  const backendToDtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
  if (!backendToDtmaApiKey) {
    throw new Error('BACKEND_TO_DTMA_API_KEY is not configured for DTMA API calls.');
  }

  const dtmaApiUrl = `http://${toolboxIp}:${dtmaPort}${path}`;
  console.log(`Calling DTMA API: ${method} ${dtmaApiUrl}`, payload || '');

  const response = await fetch(dtmaApiUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendToDtmaApiKey}`
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`DTMA API request failed to ${dtmaApiUrl} with status ${response.status}: ${errorBody}`);
    throw new Error(`DTMA API request failed: ${response.status} ${errorBody}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.indexOf('application/json') !== -1) {
    try {
      return await response.json();
    } catch (e) {
      console.error('Failed to parse JSON response from DTMA:', e);
      return {
        success: true,
        message: 'DTMA request successful, but response was not valid JSON.',
        error: (e as Error).message
      };
    }
  }

  return { success: true, message: (await response.text()) || 'DTMA request successful' };
}
