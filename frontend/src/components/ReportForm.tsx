// src/components/ReportSubmitForm.tsx
import React, { useState } from 'react';
import { z } from 'zod';
import type { Asset } from '../types/programTypes';
import MarkdownEditor from './MarkdownEditor';
import { useMarkdownEditorWithAttachments } from '../hooks/useMarkdownEditorWithAttachments';

interface ReportSubmitFormProps {
    onSubmit: (payload: FormData, filenames: string[]) => void
    isSubmitting: boolean;
    programName: string;
    organizationName: string;
    assets: Asset[];
}

const reportSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(120, 'Title must be at most 120 characters'),
    description: z
        .string()
        .min(100, 'Description must be at least 100 characters')
        .max(30000, 'Description must be at most 30000 characters'),
    severity: z.number().min(0, 'Severity must be at least 0').max(10, 'Severity must be at most 10'),
    asset_ids: z.array(z.string()).min(1, 'At least one asset must be selected'),
    files: z.array(z.instanceof(File)).refine(
        (files) =>
            files.every((file) => {
                const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
                return validTypes.includes(file.type) && file.name.length <= 255;
            }),
        'Invalid file type or name too long. Allowed: images (JPEG, PNG, GIF) with names up to 255 characters'
    ),
});

const ReportSubmitForm: React.FC<ReportSubmitFormProps> = ({
    onSubmit,
    isSubmitting,
    programName,
    organizationName,
    assets,
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState(`# Description

[Detailed description of the vulnerability and how it works.]

# Steps to Reproduce

1. [First step]
2. [Second step]
3. [Third step]
...

# Impact

[Explain the impact of the vulnerability. What could an attacker do?]

# Attachments / Proof of Concept (PoC)`);
    const [severity, setSeverity] = useState<string>('0');
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [formError, setFormError] = useState<string | null>(null);

    const {
        files,
        imagePreviews,
        imageMap,
        fileError,
        setFiles,
        removeFile,
        handleFileChange
    } = useMarkdownEditorWithAttachments();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const data = {
            title: title.trim(),
            description: description.trim(),
            severity: parseFloat(severity),
            asset_ids: selectedAssetIds,
            files: files,
        };

        const result = reportSchema.safeParse(data);
        if (!result.success) {
            setFormError(result.error.issues.map((issue) => issue.message).join(', '));
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description.trim());
        formData.append('severity', severity);
        formData.append('asset_ids', JSON.stringify(selectedAssetIds));
        files.forEach((file) => formData.append('files', file));

        onSubmit(
            formData,
            imagePreviews.map((p) => p.file.name)
        );
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="bg-white p-8 shadow rounded space-y-4">
                <p className="text-lg text-color-secondary">
                    You are submitting a report to <span className="font-bold text-color-primary">{programName}</span> by{' '}
                    <span className="font-semibold text-color-primary">{organizationName}</span>.
                </p>

                {/* --- AFFECTED ASSETS SECTION --- */}
                <div className="border border-gray-300 rounded p-4 bg-white mb-6">
                    <label className="block text-color-primary font-bold mb-2">
                        Affected Assets <span className="text-red-500">*</span>
                    </label>
                    <p className="text-sm mb-2">
                        Select the assets that are affected by this vulnerability.
                    </p>
                    <ul className={`mt-4 space-y-3 ${assets.length > 10 ? 'max-h-40 overflow-y-auto' : ''}`}>
                        {assets.map((asset) => (
                            <li key={asset.id} className="px-3 py-2 rounded border border-gray-300">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        value={asset.id}
                                        checked={selectedAssetIds.includes(asset.id)}
                                        onChange={(e) => {
                                            const id = e.target.value;
                                            setSelectedAssetIds((prev) =>
                                                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                                            );
                                        }}
                                        className="mr-3 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-indigo-600 font-semibold break-all">
                                            <span className="bg-gray-200 px-2 py-0.5 rounded text-sm font-semibold text-color-primary mr-2 inline-block">
                                                {asset.asset_type.name}
                                            </span>
                                            {asset.identifier}
                                        </p>
                                    </div>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* --- SEVERITY SCORE SECTION --- */}
                <div className="border border-gray-300 rounded p-4 bg-white mb-6">
                    <label htmlFor="severity" className="block text-color-primary font-bold mb-2">
                        Severity Score <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        id="severity"
                        value={severity}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string or valid numbers with at most 1 decimal
                            if (value === '' || /^\d*\.?\d{0,1}$/.test(value)) {
                                const numericValue = value === '' ? 0 : parseFloat(value);
                                // Additional validation: must be between 0 and 10
                                if (value === '' || (numericValue >= 0 && numericValue <= 10)) {
                                    setSeverity(value);
                                }
                                // If invalid, don't update the state (prevents invalid input)
                            }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                        maxLength={120}
                        min="0"
                        max="10"
                        step="0.1"
                        placeholder="0.0 - 10.0"
                        required
                    />
                    <p className="text-sm mt-1">
                        Enter a severity score based on the CVSS v3.1 standard (0.0 to 10.0).
                    </p>
                </div>

                {/* --- REPORT DETAILS SECTION --- */}
                <div className="border border-gray-300 rounded p-4 bg-white">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-color-primary font-bold mb-2">
                                Vulnerability Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                                required
                            />
                        </div>

                        <MarkdownEditor
                            value={description}
                            onChange={setDescription}
                            height={400}
                            files={files}
                            onFilesChange={setFiles}
                            imageMap={imageMap}
                            label="Description"
                            attachmentLabel="Attachments"
                            attachmentDescription="You can attach images (JPEG, JPG, PNG) to support your report."
                            showSubmitButton={false}
                            onFileRemove={removeFile}
                            onFileAdd={handleFileChange}
                        />
                        {fileError && <div className="text-red-600 text-sm mt-1">{fileError}</div>}
                    </div>
                </div>
            </div>

            <div className="mt-8">
                {formError && (
                    <div className="mb-4 text-red-600 bg-red-100 p-3 rounded text-center font-medium">{formError}</div>
                )}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-md font-bold disabled:bg-gray-400 cursor-pointer"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default ReportSubmitForm;
