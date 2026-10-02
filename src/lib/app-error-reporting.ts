type ErrorContext = Record<string, unknown>;

export function reportAppError(error: unknown, context: ErrorContext = {}) {
  if (import.meta.env.DEV) {
    console.error('[app-error]', context, error);
  } else {
    console.error('[app-error]', error);
  }
}