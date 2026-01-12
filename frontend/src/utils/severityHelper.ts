// frontend/src/utils/severityHelper.ts
/**
 * Utility functions for handling severity score formatting and categorization.
 * Centralizes the logic for severity levels, thresholds, and associated colors.
 */

export interface SeverityInfo {
    category: string;
    color: string;
}

/**
 * Determines the severity category and color based on a severity score.
 * @param severity - The severity score (0.0 to 10.0), can be null
 * @returns An object containing the category name and Tailwind CSS color classes
 */
export const getSeverityInfo = (severity: number | null): SeverityInfo => {
    if (!severity || severity === 0.0) {
        return { category: 'None', color: 'bg-gray-200 text-gray-800' };
    }
    if (severity >= 0.1 && severity <= 3.9) {
        return { category: 'Low', color: 'bg-green-200 text-green-800' };
    }
    if (severity >= 4.0 && severity <= 6.9) {
        return { category: 'Medium', color: 'bg-yellow-200 text-yellow-800' };
    }
    if (severity >= 7.0 && severity <= 8.9) {
        return { category: 'High', color: 'bg-orange-200 text-orange-800' };
    }
    if (severity >= 9.0 && severity <= 10.0) {
        return { category: 'Critical', color: 'bg-red-200 text-red-800' };
    }
    return { category: 'Unknown', color: 'bg-gray-200 text-gray-800' };
};

/**
 * Formats a severity display string combining category and score.
 * @param severity - The severity score
 * @returns Formatted string like "Low (2.5)" or "None (0.0)"
 */
export const formatSeverityDisplay = (severity: number | null): string => {
    const info = getSeverityInfo(severity);
    const score = severity ? severity.toFixed(1) : '0.0';
    return `${info.category} (${score})`;
};