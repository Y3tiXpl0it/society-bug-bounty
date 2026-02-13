import i18next from 'i18next';

/**
 * Formats a date string or Date object according to the current locale.
 *
 * @param date The date to format (string or Date object).
 * @param includeTime Whether to include the time in the output.
 * @returns A formatted date string.
 */
export const formatDate = (date: string | Date, includeTime: boolean = false): string => {
    if (!date) return '';

    const d = new Date(date);

    // Check if date is valid
    if (isNaN(d.getTime())) return '';

    const locale = i18next.language || 'en';

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    };

    if (includeTime) {
        options.hour = 'numeric';
        options.minute = 'numeric';
        options.hour12 = false;
        // options.second = 'numeric'; // Typically not needed for general display
    }

    return new Intl.DateTimeFormat(locale, options).format(d);
};

/**
 * Formats a date string or Date object as a date and time string.
 * Shortcut for formatDate(date, true).
 */
export const formatDateTime = (date: string | Date): string => {
    return formatDate(date, true);
};
