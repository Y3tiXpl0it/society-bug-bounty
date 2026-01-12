/**
 * Object for asset type display names (using const assertion for enum-like behavior).
 */
export const AssetTypeDisplayName = {
    url: 'URL',
    wildcard: 'Wildcard',
    api: 'API',
    mobile_ios: 'Mobile iOS',
    mobile_android: 'Mobile Android',
    source_code: 'Source Code',
    ip_address: 'IP Address',
    desktop_app: 'Desktop App',
    other: 'Other',
} as const;

/**
 * Gets the display name for an asset type.
 */
export const getAssetTypeDisplayName = (name: string): string => {
    return AssetTypeDisplayName[name as keyof typeof AssetTypeDisplayName] || name;
};