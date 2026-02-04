// frontend/src/components/ReportHistory.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type ReportEvent } from '../types/reportTypes';
import { type Asset } from '../types/programTypes';
import ReportHistoryItem from './ReportHistoryItem';
import { getAssetTypeDisplayName } from '../utils/assetTypeHelper';

interface ReportHistoryProps {
    reportHistory: ReportEvent[];
    reportDescription?: string;
    reportAssets?: Asset[];
    reportId: string;
    accessToken?: string | null;
}

/**
 * Component for displaying the report history timeline.
 * Separated to prevent re-renders when comment content changes.
 */
const ReportHistory: React.FC<ReportHistoryProps> = ({
    reportHistory,
    reportDescription,
    reportAssets,
    reportId,
    accessToken
}) => {
    const { t } = useTranslation();
    return (
        <>
            {/* Affected Assets */}
            {reportAssets && reportAssets.length > 0 && (
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-bold mb-4">{t('components.reportHistory.affectedAssets')}</h3>
                    <ul className="space-y-3">
                        {reportAssets.map((asset) => (
                            <li key={asset.id} className="p-2 rounded border border-gray-300">
                                <div>
                                    <p className="text-indigo-600 font-semibold break-all">
                                        <span className="bg-gray-200 px-2 py-0.5 rounded text-sm font-semibold text-color-primary mr-2 inline-block">
                                            {getAssetTypeDisplayName(asset.asset_type.name)}
                                        </span>
                                        {asset.identifier}
                                    </p>
                                    {asset.description && (
                                        <p
                                            className="text-sm text-gray-500 mt-2 break-words"
                                            style={{ whiteSpace: 'pre-line' }}
                                        >
                                            {asset.description}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Report History Timeline */}
            <div>
                {reportHistory.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {reportHistory.map((event) => (
                            <ReportHistoryItem
                                key={event.id}
                                event={event}
                                reportDescription={reportDescription}
                                reportId={reportId}
                                accessToken={accessToken}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-8 text-color-secondary">
                        {t('components.reportHistory.noHistory')}
                    </div>
                )}
            </div>
        </>
    );
};

export default React.memo(ReportHistory);