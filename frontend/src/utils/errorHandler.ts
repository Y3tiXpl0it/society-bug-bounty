// src/utils/errorHandler.ts
import toast from 'react-hot-toast';

/**
 * Determines whether an API error was already handled by apiClient.
 *
 * The backend returns structured errors shaped as:
 *   { detail: { code: "SOME_ERROR_CODE", message: "...", params?: {...} } }
 *
 * apiClient intercepts these and shows the translated toast automatically.
 * Calling toast.error() again in onError with a raw object would crash React
 * ("Objects are not valid as a React child").
 *
 * Returns true when the error is structured and was already handled.
 */
function isAlreadyHandled(err: unknown): boolean {
    const detail = (err as any)?.response?.data?.detail;
    return !!(detail && typeof detail === 'object' && detail.code);
}

/**
 * Shows an error toast for mutation onError callbacks.
 *
 * - Structured errors (detail.code present): silently skipped — apiClient
 *   already showed the translated toast.
 * - Plain-string detail: shown as-is.
 * - Everything else: shows the provided fallback message.
 *
 * Usage:
 *   onError: (err) => showErrorToast(err, t('some.fallback.key'))
 */
export function showErrorToast(err: unknown, fallback: string): void {
    if (isAlreadyHandled(err)) return;

    const detail = (err as any)?.response?.data?.detail;
    const msg = (typeof detail === 'string' ? detail : null)
        ?? (err as any)?.message
        ?? fallback;

    toast.error(msg);
}
