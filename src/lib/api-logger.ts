export function logApiError(
  method: string,
  path: string,
  context: string,
  error: unknown
) {
  const isError = error instanceof Error;
  const message = isError ? error.message : String(error);
  const stack = isError ? error.stack : undefined;
  console.error(`[API] ${method} ${path} - ${context}:`, {
    error: message,
    ...(stack && { stack }),
  });
}
