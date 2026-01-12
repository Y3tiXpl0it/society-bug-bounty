// src/components/AssetItem.tsx
import React from 'react';

interface AssetItemProps {
    typeName: string;
    identifier: string;
    description?: string;
    onRemove: () => void;
}

const AssetItem: React.FC<AssetItemProps> = ({ typeName, identifier, description, onRemove }) => {
    return (
        <div className="flex justify-between p-2 border border-gray-300 rounded">
            <div className="flex-grow min-w-0 pr-4">
                <p className="text-indigo-600 font-semibold break-all">
                    <span className="bg-gray-200 px-2 py-0.5 rounded text-sm font-semibold text-color-primary mr-2 inline-block">
                        {typeName}
                    </span>
                    {identifier}
                </p>
                {description && (
                    <p className="text-sm mt-2 break-words whitespace-normal">{description}</p>
                )}
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="w-5 h-5 bg-white hover:bg-gray-50 hover:cursor-pointer border border-red-300 rounded flex items-center justify-center text-red-500 hover:text-red-700 font-bold text-base ml-2 flex-shrink-0 self-center"
            >
                &times;
            </button>
        </div>
    );
};

export default AssetItem;

