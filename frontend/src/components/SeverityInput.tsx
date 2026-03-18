// frontend/src/components/SeverityInput.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSeverityInfo, getTranslatedSeverity } from '../utils/severityHelper';

interface SeverityInputProps {
    currentSeverity: number | null;
    onSeverityChange: (newSeverity: number) => void;
    isUpdating?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    onClose?: () => void;
}

const SeverityInput: React.FC<SeverityInputProps> = ({
    currentSeverity,
    onSeverityChange,
    isUpdating = false,
    isOpen: externalIsOpen,
    onToggle,
    onClose
}) => {
    const { t } = useTranslation();
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [selectedSeverity, setSelectedSeverity] = useState<string>((currentSeverity || 0).toString());

    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
    const toggleOpen = onToggle ? onToggle : () => setInternalIsOpen(!internalIsOpen);
    const closeOpen = onClose ? onClose : () => setInternalIsOpen(false);

    const handleSave = () => {
        onSeverityChange(parseFloat(selectedSeverity) || 0);
        closeOpen();
    };

    const severityInfo = getSeverityInfo(currentSeverity || 0);
    const selectedSeverityInfo = getSeverityInfo(parseFloat(selectedSeverity) || 0);

    return (
        <div className="relative">
            <div className="flex items-center space-x-2">
                <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${severityInfo.color}`}
                >
                    {getTranslatedSeverity(currentSeverity || 0, t)}
                </span>
                <button
                    onClick={toggleOpen}
                    className={`p-1 cursor-pointer ${isOpen ? 'text-indigo-600 hover:text-indigo-700' : 'text-gray-500 hover:text-indigo-700'}`}
                    disabled={isUpdating}
                >
                    <svg
                        className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-max min-w-min bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="py-0.5">
                        <div className="px-3 py-1">
                            <div className="flex items-center space-x-2">
                                <label className="text-sm font-medium text-color-primary">{t('components.severityInput.label')}</label>
                                <input
                                    type="number"
                                    value={selectedSeverity}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        // Allow empty string or valid numbers with at most 1 decimal
                                        if (value === '' || /^\d*\.?\d{0,1}$/.test(value)) {
                                            const numericValue = value === '' ? 0 : parseFloat(value);
                                            // Additional validation: must be between 0 and 10
                                            if (value === '' || (numericValue >= 0 && numericValue <= 10)) {
                                                setSelectedSeverity(value);
                                            }
                                            // If invalid, don't update the state (prevents invalid input)
                                        }
                                    }}
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    placeholder="0.0"
                                    disabled={isUpdating}
                                />
                            </div>
                            <div className="text-xs text-gray-600 mt-2 mb-1 whitespace-nowrap">
                                {t('components.severityInput.selected')} <span className={`px-2 py-1 rounded-full ${selectedSeverityInfo.color}`}>
                                    {getTranslatedSeverity(parseFloat(selectedSeverity) || 0, t)}
                                </span>
                            </div>
                        </div>
                    </div>
                    {(parseFloat(selectedSeverity) || 0) !== (currentSeverity || 0) && (
                        <div className="border-t border-gray-200 p-1.5">
                            <button
                                onClick={handleSave}
                                className="w-full px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                disabled={isUpdating}
                            >
                                {isUpdating ? t('components.severityInput.saving') : t('components.severityInput.save')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SeverityInput;