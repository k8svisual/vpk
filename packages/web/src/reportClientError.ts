/**
 * Sends a client-side error to the server's log buffer (POST /client-error, see server.ts's own doc comment
 * on that route) so it shows up in the Logs viewer and the diagnostic bundle download — the same place every
 * server-side problem already ends up, instead of only ever reaching the browser's own devtools console.
 * Fire-and-forget: a failed error REPORT shouldn't itself throw or block whatever's already going wrong.
 */
export function reportClientError(source: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  fetch('/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source, message, stack }),
  }).catch(() => {
    // the server being unreachable is exactly the kind of situation this can't itself do anything about
  });
}
