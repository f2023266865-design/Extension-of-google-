const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

export function corsHeaders(origin?: string, methods = 'GET, POST, OPTIONS') {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function jsonResponse(statusCode: number, payload: unknown, extraHeaders?: Record<string, string>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {})
    },
    body: JSON.stringify(payload)
  };
}
