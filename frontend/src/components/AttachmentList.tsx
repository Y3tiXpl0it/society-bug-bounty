import React from 'react';
import type { Attachment } from '../types/commonTypes';
import attachmentService from '../services/attachmentService';

interface AttachmentListProps {
    attachments?: Attachment[];
    contextUrl?: string;
    accessToken?: string | null;
}

const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, contextUrl, accessToken }) => {
    if (!attachments || attachments.length === 0) return null;

    const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>, attachment: Attachment) => {
        e.preventDefault();

        if (!contextUrl || !accessToken) {
            console.error('Missing contextUrl or accessToken for download');
            return;
        }

        const downloadUrl = `${contextUrl}/attachments/${attachment.id}/download`;

        try {
            // Use the standardized attachment service for downloading
            const blob = await attachmentService.downloadAttachment(downloadUrl, accessToken);

            // Create a URL for the blob
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.file_name;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            // Error handling is already done by apiFetch (toasts), but we can add specific fallback here if needed
        }
    };

    return (
        <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                Attachments
            </p>
            <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                    <a
                        key={att.id}
                        href="#"
                        onClick={(e) => handleDownload(e, att)}
                        className="group flex items-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm hover:bg-white hover:border-indigo-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
                    >
                        {/* Clip icon */}
                        <svg className="w-4 h-4 mr-2 text-gray-400 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>

                        {/* File name */}
                        <span className="text-gray-700 font-medium group-hover:text-indigo-600 truncate max-w-[200px]" title={att.file_name}>
                            {att.file_name}
                        </span>

                        {/* File size */}
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                            {(att.file_size / 1024).toFixed(1)} KB
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default AttachmentList;