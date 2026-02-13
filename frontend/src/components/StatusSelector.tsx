// frontend/src/components/StatusSelector.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusInfo, getTranslatedStatus } from '../utils/statusHelper';

interface StatusSelectorProps {
    currentStatus: string;
    onStatusChange: (newStatus: string) => void;
    isUpdating?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    onClose?: () => void;
}

const StatusSelector: React.FC<StatusSelectorProps> = ({
    currentStatus,
    onStatusChange,
    isUpdating = false,
    isOpen: externalIsOpen,
    onToggle,
    onClose
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(currentStatus);

    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
    const toggleOpen = onToggle ? onToggle : () => setInternalIsOpen(!internalIsOpen);
    const closeOpen = onClose ? onClose : () => setInternalIsOpen(false);
    const { t } = useTranslation();

    const statusOptions = [
        { value: 'received', label: t('components.statusSelector.received'), color: 'bg-gray-200 text-gray-800' },
        { value: 'in_review', label: t('components.statusSelector.inReview'), color: 'bg-yellow-200 text-yellow-800' },
        { value: 'accepted', label: t('components.statusSelector.accepted'), color: 'bg-green-200 text-green-800' },
        { value: 'rejected', label: t('components.statusSelector.rejected'), color: 'bg-red-200 text-red-800' },
        { value: 'duplicate', label: t('components.statusSelector.duplicate'), color: 'bg-gray-200 text-gray-800' },
        { value: 'out_of_scope', label: t('components.statusSelector.outOfScope'), color: 'bg-orange-200 text-orange-800' },
        { value: 'resolved', label: t('components.statusSelector.resolved'), color: 'bg-blue-200 text-blue-800' },
    ];

    const handleStatusSelect = (status: string) => {
        // Validate that the status is one of the allowed values
        const validStatuses = statusOptions.map(option => option.value);
        if (validStatuses.includes(status)) {
            setSelectedStatus(status);
        }
    };

    const handleSave = () => {
        if (selectedStatus !== currentStatus) {
            onStatusChange(selectedStatus);
        }
        closeOpen();
    };

    const statusInfo = getStatusInfo(currentStatus);

    return (
        <div className="relative">
            <div className="flex items-center space-x-2">
                <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}
                >
                    {getTranslatedStatus(statusInfo.value, t)}
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
                <div className="absolute top-full left-0 mt-1 w-42 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    <div className="py-0.5">
                        {statusOptions.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleStatusSelect(option.value)}
                                className={`w-full text-left px-3 py-1 text-sm hover:bg-gray-100 flex items-center space-x-2 cursor-pointer ${selectedStatus === option.value ? 'bg-blue-50' : ''
                                    }`}
                                disabled={isUpdating}
                            >
                                <span
                                    className={`px-2 py-1 text-xs font-semibold rounded-full ${option.color}`}
                                >
                                    {option.label}
                                </span>
                                {selectedStatus === option.value && (
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                    {selectedStatus !== currentStatus && (
                        <div className="border-t border-gray-200 p-1.5">
                            <button
                                onClick={handleSave}
                                className="w-full px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                disabled={isUpdating}
                            >
                                {isUpdating ? t('components.statusSelector.saving') : t('components.statusSelector.save')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StatusSelector;