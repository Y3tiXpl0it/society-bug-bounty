// frontend/src/utils/statusHelper.ts
/**
 * Utility functions for handling status categorization and display.
 * Centralizes the logic for status labels, values, and associated colors.
 */

export interface StatusInfo {
    value: string;
    label: string;
    color: string;
}

/**
 * Predefined status options with their labels and colors.
 */
const statusOptions: StatusInfo[] = [
    { value: 'received', label: 'Received', color: 'bg-gray-200 text-gray-800' },
    { value: 'in_review', label: 'In Review', color: 'bg-yellow-200 text-yellow-800' },
    { value: 'accepted', label: 'Accepted', color: 'bg-green-200 text-green-800' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-200 text-red-800' },
    { value: 'duplicate', label: 'Duplicate', color: 'bg-gray-200 text-gray-800' },
    { value: 'out_of_scope', label: 'Out of Scope', color: 'bg-orange-200 text-orange-800' },
    { value: 'resolved', label: 'Resolved', color: 'bg-blue-200 text-blue-800' },
];

/**
 * Gets status information for a given status value.
 * @param status - The status value (e.g., 'accepted', 'rejected')
 * @returns StatusInfo object containing value, label, and color, or default 'received' if not found
 */
export const getStatusInfo = (status: string): StatusInfo => {
    return statusOptions.find(option => option.value === status) || statusOptions[0];
};

/**
 * Gets the translated label for a given status.
 * @param status - The status value
 * @param t - The translation function from i18next
 * @returns The translated status label
 */
export const getTranslatedStatus = (status: string, t: (key: string) => string): string => {
    const keyMap: Record<string, string> = {
        'received': 'received',
        'in_review': 'inReview',
        'accepted': 'accepted',
        'rejected': 'rejected',
        'duplicate': 'duplicate',
        'out_of_scope': 'outOfScope',
        'resolved': 'resolved',
    };
    const key = keyMap[status];
    return key ? t(`components.statusSelector.${key}`) : getStatusInfo(status).label;
};
