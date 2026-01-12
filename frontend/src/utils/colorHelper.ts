// /frontend/src/utils/colorHelper.ts
/**
 * This utility provides helper functions for generating deterministic colors from strings,
 * ensuring a consistent UI for elements like avatars or default logos.
 */

// A predefined list of Tailwind CSS background color classes from the 500 shade.
const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
];

/**
 * Deterministically generates a Tailwind CSS background color class from a string.
 * This ensures that the same input string will always produce the same color,
 * providing a consistent user experience.
 * @param {string} name - The input string, such as an organization's name.
 * @returns {string} A Tailwind CSS background color class (e.g., 'bg-blue-500').
 */
export const generateBackgroundColor = (name: string): string => {
    // Return a default color if the input string is empty.
    if (!name) {
        return "bg-gray-500";
    }

    // This is a simple, non-cryptographic hashing function (djb2 variant)
    // to convert the string into a numeric hash.
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to a 32bit integer.
    }

    // Use the modulo operator to get a remainder that fits within the bounds of the colors array.
    // Math.abs() ensures the index is non-negative.
    const index = Math.abs(hash % colors.length);
    return colors[index];
};
