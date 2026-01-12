// src/services/assetTypeService.ts

import { apiGet } from "../utils/apiClient";

/**
 * Defines the structure of an Asset Type object, as returned by the API.
 */
export interface AssetType {
    id: number;
    name: string;
    description: string | null;
}

/**
 * A service object for handling API calls related to asset types.
 */
const assetTypeService = {
    /**
     * Fetches all available asset types from the backend.
     */
    getAll: async (
        accessToken: string | null,
        onTokenRefresh?: (newToken: string) => void
    ): Promise<AssetType[]> => {
        return apiGet('/asset_types/', accessToken, onTokenRefresh);
    },
};

export default assetTypeService;
