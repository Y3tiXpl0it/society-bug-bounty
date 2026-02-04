// src/components/ProgramForm.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MarkdownEditor from './MarkdownEditor';
import { z } from 'zod';
import AssetItem from './AssetItem';
import { useAuth } from '../hooks/useAuth';
import assetTypeService, { type AssetType } from '../services/assetTypeService';
import { getAssetTypeDisplayName } from '../utils/assetTypeHelper';
import { type Reward, type Asset, type NewAsset, type ProgramCreateData, type ProgramBulkUpdateData, type ProgramDetail } from '../types/programTypes';

/**
 * Defines the consistent display order for reward severity levels.
 * This prevents the UI from reordering them based on API response order.
 */
const severityOrder: { [key in Reward['severity']]: number } = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};

const programSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(120, 'Name must be at most 120 characters'),
    description: z
        .string()
        .min(100, 'Description must be at least 100 characters')
        .max(30000, 'Description must be at most 30000 characters'),
});

const assetSchema = z.object({
    identifier: z
        .string()
        .min(2, 'Identifier must be at least 2 characters')
        .max(255, 'Identifier must be at most 255 characters'),
    description: z.string().max(1000, 'Description must be at most 1000 characters'),
});

// --- Component Props ---
interface ProgramFormProps {
    /** The function to call when the form is submitted. */
    onSubmit: (payload: ProgramCreateData | ProgramBulkUpdateData) => Promise<void>;
    /** Optional data used to populate the form for editing an existing program. */
    initialData?: ProgramDetail;
    /** A boolean to indicate if the form is currently in the process of submitting. */
    isSubmitting: boolean;
    /** The text to display on the main submit button. */
    submitButtonText: string;
    /** An optional render prop to include extra action buttons (e.g., a "Delete" button). */
    renderExtraActions?: () => React.ReactNode;
}


const ProgramForm: React.FC<ProgramFormProps> = ({
    onSubmit,
    initialData,
    isSubmitting,
    submitButtonText,
    renderExtraActions,
}) => {
    const { t } = useTranslation();
    const { user, accessToken, setAccessToken } = useAuth();

    // --- Form State ---
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [rewards, setRewards] = useState<Reward[]>([]);
    /** State for assets that already exist in the database. */
    const [assets, setAssets] = useState<Asset[]>([]);
    /** State for new assets added by the user in the current session (not yet saved). */
    const [newlyAddedAssets, setNewlyAddedAssets] = useState<NewAsset[]>([]);
    /** An array of asset IDs to be deleted upon submission. */
    const [assetsToDelete, setAssetsToDelete] = useState<string[]>([]);
    const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
    const [newAssetForm, setNewAssetForm] = useState({
        asset_type_id: 1,
        identifier: '',
        description: '',
    });
    const [formError, setFormError] = useState<string | null>(null);
    const [assetError, setAssetError] = useState<string | null>(null);

    /**
     * Effect to initialize the form's state. It handles two scenarios:
     * 1. Edit Mode: Populates the form fields using `initialData`.
     * 2. Create Mode: Sets default values, such as the user's first organization and zeroed-out rewards.
     * It also fetches the available asset types on component mount.
     */
    useEffect(() => {
        // Edit Mode: Populate with existing data
        if (initialData) {
            setName(initialData.name || '');
            setDescription(initialData.description || '');
            setIsActive(initialData.is_active !== undefined ? initialData.is_active : true);
            const sortedRewards = (initialData.rewards || []).sort(
                (a: Reward, b: Reward) => severityOrder[b.severity] - severityOrder[a.severity]
            );
            setRewards(sortedRewards);
            setAssets(initialData.assets || []);
            setSelectedOrgId(initialData.organization_id || '');
        }
        // Create Mode: Set defaults for a new program
        else if (user?.organizations && user.organizations.length > 0) {
            setSelectedOrgId('');
            // Set default description template
            setDescription(`# Scope

## In Scope

- \`*.example.com\`
- iOS mobile application (latest version)
- Android mobile application (latest version)

## Out of Scope

- \`blog.example.com\`
- Any third-party sites or services.
- Denial of Service (DoS/DDoS) attacks.
- Spam or social engineering.

# Program Rules

- Do not publicly disclose vulnerabilities before they have been resolved.
- Avoid tests that could affect other users.
- Do not access user data without authorization.`);
            // Set default rewards to 0
            setRewards([
                { severity: 'low', amount: 0 },
                { severity: 'medium', amount: 0 },
                { severity: 'high', amount: 0 },
                { severity: 'critical', amount: 0 },
            ]);
        }

        // Fetch available asset types from the server
        assetTypeService
            .getAll(accessToken, setAccessToken)
            .then((types) => {
                setAssetTypes(types);
                // Set the default asset type in the "Add Asset" form
                if (types.length > 0) {
                    setNewAssetForm((prev) => ({
                        ...prev,
                        asset_type_id: types[0].id,
                    }));
                }
            })
            .catch(() => setFormError('Could not load asset types. Please refresh the page.'));
    }, [initialData, user, accessToken, setAccessToken]);

    // --- Event Handlers ---

    /**
     * Adds a new asset to the client-side list of `newlyAddedAssets`.
     * Performs validation to prevent duplicate identifiers and ensure minimum lengths.
     */
    const handleAddAsset = () => {
        // Zod validation for asset fields
        const assetResult = assetSchema.safeParse(newAssetForm);
        if (!assetResult.success) {
            setAssetError(assetResult.error.issues.map((issue) => issue.message).join(', '));
            return;
        }

        const isExisting = assets.some((asset) => asset.identifier === newAssetForm.identifier);
        const isNewDuplicate = newlyAddedAssets.some((asset) => asset.identifier === newAssetForm.identifier);

        if (isExisting || isNewDuplicate) {
            setAssetError(`Asset with identifier '${newAssetForm.identifier}' already exists in the list.`);
            return;
        }

        setAssetError(null);
        setNewlyAddedAssets((prev) => [...prev, { ...newAssetForm, tempId: Date.now() }]);
        // Reset the new asset form for the next entry
        setNewAssetForm({
            asset_type_id: assetTypes[0]?.id || 1,
            identifier: '',
            description: '',
        });
    };

    /**
     * Marks an existing asset for deletion. It is removed from the UI and its ID is added
     * to the `assetsToDelete` array for processing on submission.
     */
    const handleRemoveExistingAsset = (assetId: string) => {
        setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
        setAssetsToDelete((prev) => [...prev, assetId]);
    };

    /** Removes a newly added asset from the client-side list before it's saved. */
    const handleRemoveNewAsset = (tempId: number) => {
        setNewlyAddedAssets((prev) => prev.filter((asset) => asset.tempId !== tempId));
    };

    /** Updates the amount for a specific reward severity level. */
    const handleRewardChange = (severity: Reward['severity'], amount: string) => {
        const num = parseInt(amount.replace(/,/g, ''), 10) || 0;
        const clamped = Math.max(0, Math.min(2147483647, num));
        setRewards(rewards.map((r) => (r.severity === severity ? { ...r, amount: clamped } : r)));
    };

    /**
     * Validates the form and constructs the final payload for submission.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Zod validation for basic fields
        const fieldResult = programSchema.safeParse({ name, description });
        if (!fieldResult.success) {
            setFormError(fieldResult.error.issues.map((issue) => issue.message).join(', '));
            return;
        }

        // Validation checks
        const finalAssetCount = assets.length - assetsToDelete.length + newlyAddedAssets.length;
        if (finalAssetCount < 1) {
            setFormError('A program must have at least one asset.');
            return;
        }
        if (!selectedOrgId && !initialData) {
            setFormError('Please select an organization.');
            return;
        }

        let payload;

        if (initialData) {
            // EDIT MODE: Use the complex structure required for updating.
            payload = {
                details: { name, description, is_active: isActive },
                rewards: rewards,
                assets: {
                    assets_to_add: newlyAddedAssets.map(({ tempId, ...rest }) => rest),
                    asset_ids_to_delete: assetsToDelete,
                },
            };
        } else {
            // CREATE MODE: Use the simpler structure for creation.
            payload = {
                name,
                description,
                is_active: isActive,
                organization_id: selectedOrgId,
                rewards: rewards,
                // The creation endpoint likely expects a simple array of assets.
                assets: newlyAddedAssets.map(({ tempId, ...rest }) => rest),
            };
        }

        // The actual submission logic is passed via props from the parent component.
        await onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="bg-white p-8 shadow rounded">
                {/* --- PROGRAM DETAILS SECTION --- */}
                <div className="border border-gray-300 rounded p-4 bg-white mb-6">
                    <div className="space-y-4">
                        {/* The organization selector is only shown in Create mode */}
                        {!initialData && user?.organizations && user.organizations.length > 0 && (
                            <div>
                                <label htmlFor="organization" className="block text-color-primary font-bold mb-2">
                                    {t('components.programForm.createFor')} <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="organization"
                                    value={selectedOrgId}
                                    onChange={(e) => {
                                        setSelectedOrgId(e.target.value);
                                        e.target.blur();
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                >
                                    <option value="">{t('components.programForm.selectOrg')}</option>
                                    {user.organizations.map((org) => (
                                        <option key={org.id} value={org.id}>
                                            {org.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="name" className="block text-color-primary font-bold mb-2">
                                {t('components.programForm.programName')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-color-primary font-bold mb-2">
                                {t('components.programForm.description')} <span className="text-red-500">*</span>
                            </label>
                            <MarkdownEditor
                                value={description}
                                onChange={setDescription}
                                height={400}
                                files={[]} // Empty array since programs don't need attachments for now
                                onFilesChange={() => { }} // No-op since we don't handle attachments
                                imageMap={{}}
                                label=""
                                showAttachments={false} // Hide attachments for programs
                                showSubmitButton={false}
                            />
                        </div>
                    </div>
                </div>

                {/* --- ASSETS SECTION --- */}
                <div className="border border-gray-300 rounded p-4 bg-white mb-6">
                    <h2 className="font-bold text-color-primary mb-4">
                        {t('components.programForm.inScopeAssets')} <span className="text-red-500">*</span>
                    </h2>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            {/* List of existing assets */}
                            {assets.map((asset) => (
                                <AssetItem
                                    key={asset.id}
                                    typeName={getAssetTypeDisplayName(asset.asset_type.name)}
                                    identifier={asset.identifier}
                                    description={asset.description}
                                    onRemove={() => handleRemoveExistingAsset(asset.id)}
                                />
                            ))}
                            {/* List of newly added assets */}
                            {newlyAddedAssets.map((asset) => (
                                <AssetItem
                                    key={asset.tempId}
                                    typeName={
                                        getAssetTypeDisplayName(assetTypes.find((type) => type.id === asset.asset_type_id)?.name || 'Unknown')
                                    }
                                    identifier={asset.identifier}
                                    description={asset.description}
                                    onRemove={() => handleRemoveNewAsset(asset.tempId)}
                                />
                            ))}
                            {assets.length === 0 && newlyAddedAssets.length === 0 && (
                                <p className="text-center py-4">{t('components.programForm.noAssets')}</p>
                            )}
                        </div>
                        <h3 className="font-semibold text-color-primary mb-2">{t('components.programForm.addNewAssetHeader')}</h3>
                        {/* Form to add a new asset */}
                        <div className="space-y-0 p-4 border border-gray-300 rounded bg-white">
                            <div className="flex space-x-2">
                                <div className="flex-none w-40">
                                    <select
                                        value={newAssetForm.asset_type_id}
                                        onChange={(e) => {
                                            setNewAssetForm({
                                                ...newAssetForm,
                                                asset_type_id: parseInt(e.target.value),
                                            });
                                            e.target.blur();
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary h-10 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                                    >
                                        {assetTypes.map((type) => (
                                            <option key={type.id} value={type.id}>
                                                {getAssetTypeDisplayName(type.name)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder={t('components.programForm.identifierPlaceholder')}
                                        value={newAssetForm.identifier}
                                        onChange={(e) =>
                                            setNewAssetForm({
                                                ...newAssetForm,
                                                identifier: e.target.value,
                                            })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary h-10 focus:outline-none focus:border-indigo-500"
                                        maxLength={255}
                                    />
                                </div>
                            </div>
                            <textarea
                                placeholder={t('components.programForm.descriptionPlaceholder')}
                                value={newAssetForm.description}
                                onChange={(e) =>
                                    setNewAssetForm({
                                        ...newAssetForm,
                                        description: e.target.value,
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary mt-2 focus:outline-none focus:border-indigo-500"
                                rows={2}
                                maxLength={1000}
                            />
                            {assetError && <p className="text-red-500 text-sm mt-2">{assetError}</p>}
                            <button
                                type="button"
                                onClick={handleAddAsset}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                            >
                                {t('components.programForm.addAssetButton')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- REWARDS SECTION --- */}
                <div className="border border-gray-300 rounded p-4 bg-white">
                    <h2 className="font-bold text-color-primary mb-4">{t('components.programForm.rewardGrid')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {rewards.map((reward) => (
                            <div key={reward.severity}>
                                <label
                                    htmlFor={`reward-${reward.severity}`}
                                    className="block text-color-primary font-bold mb-2 capitalize"
                                >
                                    {reward.severity}
                                </label>
                                <input
                                    type="text"
                                    id={`reward-${reward.severity}`}
                                    value={reward.amount.toLocaleString()}
                                    onChange={(e) =>
                                        handleRewardChange(reward.severity, e.target.value.replace(/,/g, ''))
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- ACTIONS SECTION --- */}
            <div className="mt-8">
                {formError && (
                    <div className="mb-4 text-red-600 bg-red-100 p-3 rounded text-center font-medium">{formError}</div>
                )}
                <div className="flex justify-between items-center">
                    <label htmlFor="isActiveToggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="isActiveToggle"
                                className="sr-only"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                            />
                            <div
                                className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-gray-200'
                                    }`}
                            ></div>
                            <div
                                className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'transform translate-x-6' : ''
                                    }`}
                            ></div>
                        </div>
                        <div className="ml-3 text-color-primary">
                            <span className="font-bold">{t('components.programForm.programStatus')}</span>
                            <span className={`ml-2 font-semibold ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>
                                {isActive ? t('components.programForm.active') : t('components.programForm.inactive')}
                            </span>
                        </div>
                    </label>
                    <div className="flex items-center space-x-4">
                        {/* Render any extra action buttons passed via props */}
                        {renderExtraActions && renderExtraActions()}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-md font-bold disabled:bg-gray-400 cursor-pointer"
                        >
                            {isSubmitting ? t('components.programForm.saving') : submitButtonText}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default ProgramForm;
