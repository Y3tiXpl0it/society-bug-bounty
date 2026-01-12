// frontend/src/types/programTypes.ts
import type { Organization } from './commonTypes';

/**
 * Defines the structure for a program's reward, mapping a severity level
 * to a specific monetary amount.
 */
export interface Reward {
    severity: 'critical' | 'high' | 'medium' | 'low';
    amount: number;
}

/**
 * Represents an asset that is already persisted in the database.
 * This is the "Read" model for an asset.
 */
export interface Asset {
    id: string;
    asset_type_id: number;
    identifier: string;
    description?: string;
    asset_type: { name: string };
}

/**
 * Represents a new asset that has not yet been saved to the database.
 * This is typically used for client-side state management before submission.
 */
export interface NewAsset {
    tempId: number; // A temporary ID for React keys before the asset is saved.
    asset_type_id: number;
    identifier: string;
    description: string;
}


/**
 * Represents the summarized view of a program, used for list pages.
 * It deliberately omits heavy fields like 'description' and 'assets' for performance.
 */
export interface ProgramSummary {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    deleted_at: string | null;
    rewards: Reward[];
    organization: Organization;
}

/**
 * Represents the paginated response for programs from the API.
 */
export interface PaginatedPrograms {
    total: number;
    programs: ProgramSummary[];
}

/**
 * Represents the full, detailed view of a program.
 * It includes all fields, including heavy ones, for detail or edit pages.
 */
export interface ProgramDetail {
    id: string;
    name: string;
    slug: string;
    description: string;
    is_active: boolean;
    rewards: Reward[];
    assets: Asset[];
    organization: Organization;
    organization_id: string;
}

/**
 * Defines the structure for reward data sent to the API.
 */
interface RewardData {
    severity: 'critical' | 'high' | 'medium' | 'low';
    amount: number;
}

/**
 * Defines the structure for creating a new asset.
 */
interface AssetCreateData {
    asset_type_id: number;
    identifier: string;
    description?: string;
}

/**
 * Defines the complete payload for creating a new program.
 */
export interface ProgramCreateData {
    name: string;
    description: string;
    organization_id: string;
    rewards: RewardData[];
    assets: AssetCreateData[];
    is_active?: boolean;
}

/**
 * Defines the structure for updating a program's top-level details.
 * All fields are optional for PATCH requests.
 */
interface ProgramUpdateData {
    name?: string;
    description?: string;
    is_active?: boolean;
}

/**
 * Defines the structure for bulk-updating assets within a program.
 */
interface AssetsBulkUpdateData {
    assets_to_add: AssetCreateData[];
    asset_ids_to_delete: string[];
}

/**
 * Defines the main payload for the bulk update endpoint.
 * It allows updating details, rewards, and assets in a single request.
 */
export interface ProgramBulkUpdateData {
    details?: ProgramUpdateData;
    rewards?: RewardData[];
    assets?: AssetsBulkUpdateData;
}
