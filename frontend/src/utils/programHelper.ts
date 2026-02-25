// src/utils/programHelpers.ts

/**
 * Generates the first letter of the first two words of a name.
 * @param name The string to generate initials from.
 * @returns The uppercase initials (e.g., "John Doe" -> "JD").
 */
export const getInitials = (name: string): string => {
    if (!name) return '';
    return name
        .split(' ')
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
};

/**
 * Formats the reward display based on an array of reward tiers.
 * - If all rewards are 0, it shows "$0".
 * - If only one tier has an amount, it shows that amount (e.g., "$500").
 * - If multiple tiers have amounts, it shows a range (e.g., "$100 - $2500").
 * @param rewards Object containing the 4 reward amounts
 * @returns A formatted string representing the reward.
 */
export const formatReward = (rewards: { critical: number, high: number, medium: number, low: number }): string => {
    if (!rewards) {
        return 'Not specified';
    }
    const amounts = [rewards.critical, rewards.high, rewards.medium, rewards.low];
    const validAmounts = amounts.filter((amount) => amount > 0);
    if (validAmounts.length === 0) {
        return '$0';
    }
    if (validAmounts.length === 1) {
        return `$${validAmounts[0].toLocaleString()}`;
    }
    const min = Math.min(...validAmounts);
    const max = Math.max(...validAmounts);
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
};
