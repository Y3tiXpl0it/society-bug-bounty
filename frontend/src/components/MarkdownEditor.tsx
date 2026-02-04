// frontend/src/components/MarkdownEditor.tsx

// Import necessary React hooks and components
import React, { useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
// Markdown editor component from @uiw/react-markdown-editor
import MarkdownEditor from '@uiw/react-markdown-editor';
// ReactMarkdown for rendering markdown in preview
import ReactMarkdown from 'react-markdown';
// Custom markdown components utility
import { getProgramMarkdownComponents } from '../utils/markdownComponents';
// Decode HTML entities
import { decode } from 'html-entities';
// Remark plugin for GitHub Flavored Markdown
import remarkGfm from 'remark-gfm';
// @ts-ignore - Ignoring TypeScript for rehype-figure as it may not have types
import rehypeFigure from 'rehype-figure';
// Sanitize HTML in markdown
import { rehypePlugins } from '../utils/markdownUtils';

/**
 * Props interface for the CustomMarkdownEditor component.
 * Defines all the configurable properties for the markdown editor.
 */
interface MarkdownEditorProps {
    value: string; // The current markdown content
    onChange: (value: string) => void; // Callback when content changes
    placeholder?: string; // Placeholder text for the editor
    height?: number; // Height of the editor in pixels
    files: File[]; // Array of attached files
    onFilesChange: (files: File[]) => void; // Callback when files change
    accept?: string; // Accepted file types for attachments
    imageMap?: Record<string, string>; // Mapping for image URLs
    label?: string; // Label for the editor
    attachmentLabel?: string; // Label for attachments section
    attachmentDescription?: string; // Description for attachments
    showAttachments?: boolean; // Whether to show attachments UI
    showSubmitButton?: boolean; // Whether to show submit button
    submitButtonText?: string; // Text for submit button
    onSubmit?: (formData: FormData) => Promise<void>; // Submit callback
    isSubmitting?: boolean; // Loading state for submission
    onFileRemove?: (index: number) => void; // Callback when file is removed
    onFileAdd?: (files: File[]) => void; // Callback when files are added
    accessToken?: string | null; // Access token for API calls
}

/**
 * CustomMarkdownEditor component.
 * A markdown editor with support for attachments, image mapping, and submission.
 * Renders a markdown editor with preview and optional file attachment functionality.
 */
const CustomMarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value,
    onChange,
    height = 200,
    files,
    onFilesChange,
    accept = "image/*",
    imageMap = {},
    label = "Content",
    attachmentLabel = "Attachments",
    attachmentDescription = "You can attach images (JPEG, JPG, PNG) to support your content.",
    showAttachments = true,
    showSubmitButton = false,
    submitButtonText = "Submit",
    onSubmit,
    isSubmitting = false,
    onFileRemove,
    onFileAdd,
    accessToken
}) => {
    const { t } = useTranslation();

    // Use props or fall back to translated defaults
    const finalLabel = label === "Content" ? t('components.markdownEditor.contentLabel') : label;
    const finalAttachmentLabel = attachmentLabel === "Attachments" ? t('components.markdownEditor.attachmentsLabel') : attachmentLabel;
    const finalAttachmentDescription = attachmentDescription === "You can attach images (JPEG, JPG, PNG) to support your content."
        ? t('components.markdownEditor.attachmentDescription')
        : attachmentDescription;
    const finalSubmitButtonText = submitButtonText === "Submit" ? t('components.markdownEditor.submit') : submitButtonText;

    // Ref to the hidden file input for triggering file selection
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sanitize filename by replacing spaces with underscores
    const sanitizeFilename = (name: string) => name.replace(/ /g, '_');

    // Handle file selection from the input
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            onFileAdd?.(selectedFiles); // Call the add callback
            e.target.value = ''; // Reset input value to allow re-selecting same file
        }
    };

    // Handle removing a file from the attachments list
    const handleFileRemove = (index: number) => {
        if (onFileRemove) {
            onFileRemove(index);
        } else {
            onFilesChange(files.filter((_, i) => i !== index));
        }
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!value.trim() || !onSubmit) return; // Prevent if no content or no submit handler
        const formData = new FormData();
        formData.append('content', value.trim()); // Add trimmed content
        files.forEach((file) => formData.append('files', file)); // Add all files
        formData.append('processedContent', value); // Add untrimmed content
        onSubmit(formData); // Call submit callback
    };

    // Get custom markdown components for rendering
    const customComponents = useMemo(() => getProgramMarkdownComponents({
        accessToken: accessToken,
        onImageClick: (src) => console.log('Image clicked:', src)
    }), [accessToken]);

    return (
        // Main container with vertical spacing
        <div className="space-y-4">
            {/* Markdown Editor Section */}
            <div>
                {/* Label for the editor */}
                <label className="block text-color-primary font-bold mb-2">
                    {finalLabel}
                </label>
                {/* Container for the markdown editor with light color mode */}
                <div data-color-mode="light">
                    <MarkdownEditor
                        value={value} // Current markdown value
                        onChange={(val) => onChange(val)} // Handle content changes
                        height={`${height}px`} // Set editor height
                        enableScroll={true} // Allow scrolling in editor
                        visible={true} // Make editor visible

                        // Custom preview renderer
                        renderPreview={(props) => {
                            return (
                                // Preview container with styling
                                <div className="markdown-content bg-white h-full p-4 overflow-auto">
                                    {/* Render markdown with custom components and plugins */}
                                    <ReactMarkdown
                                        skipHtml={true}
                                        components={customComponents} // Use custom components
                                        remarkPlugins={[remarkGfm]} // GitHub Flavored Markdown
                                        rehypePlugins={rehypePlugins} // Figure and sanitize plugins
                                        // Transform URLs for image mapping
                                        urlTransform={(url) => {
                                            if (imageMap && imageMap[url]) {
                                                return imageMap[url]; // Direct mapping
                                            }

                                            const sanitized = url.replace(/ /g, '_'); // Sanitize URL
                                            if (imageMap && imageMap[sanitized]) {
                                                return imageMap[sanitized]; // Mapped sanitized URL
                                            }

                                            return url; // Return original if no mapping
                                        }}
                                    >
                                        {decode(props.source || '')}
                                    </ReactMarkdown>
                                </div>
                            );
                        }}
                    />
                </div>
            </div>

            {/* Attachments Section - conditionally rendered */}
            {showAttachments && (
                <div>
                    {/* Label for attachments */}
                    <label className="block text-color-primary font-bold mb-2">{finalAttachmentLabel}</label>
                    {/* Hidden file input for selecting files */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        multiple // Allow multiple files
                        onChange={handleFileChange} // Handle file selection
                        className="hidden" // Hide the input
                        accept={accept} // Accepted file types
                    />
                    {/* Button to trigger file input click */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()} // Programmatically click input
                        className="bg-gray-200 hover:bg-gray-300 text-color-primary px-4 py-2 rounded font-medium flex items-center cursor-pointer"
                    >
                        {/* SVG icon for attachment */}
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                        </svg>
                        {t('components.markdownEditor.addAttachments')}
                    </button>
                    {/* Description for attachments */}
                    <p className="text-sm mt-1">
                        {finalAttachmentDescription}
                    </p>
                    {/* List of attached files - only show if files exist */}
                    {files.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-color-primary font-semibold mb-2">{t('components.markdownEditor.attachedFiles')}</h4>
                            <div className="space-y-2">
                                {/* Map over files to display each */}
                                {files.map((file: File, index: number) => (
                                    <div
                                        key={`${file.name}-${index}`}
                                        className="flex justify-between items-center py-1 px-2 bg-gray-50 border border-gray-300 rounded"
                                    >
                                        {/* Display sanitized filename */}
                                        <span className="text-sm text-color-primary">
                                            {sanitizeFilename(file.name)}
                                        </span>
                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={() => handleFileRemove(index)} // Remove file
                                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                                            title={t('components.markdownEditor.removeFile')}
                                        >
                                            {/* Trash icon */}
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Submit Button Section - conditionally rendered */}
            {showSubmitButton && (
                <div className="mt-8">
                    <div className="flex justify-end">
                        {/* Submit button */}
                        <button
                            type="button"
                            onClick={handleSubmit} // Handle form submission
                            disabled={isSubmitting} // Disable while submitting
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-2 rounded-md font-bold disabled:bg-gray-400 cursor-pointer"
                        >
                            {isSubmitting ? t('components.markdownEditor.submitting') : finalSubmitButtonText} {/* Dynamic text based on state */}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Export the component as default
export default CustomMarkdownEditor;