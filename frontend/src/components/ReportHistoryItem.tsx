// frontend/src/components/ReportHistoryItem.tsx
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { decode } from 'html-entities';
import type { ReportEvent } from '../types/reportTypes';
import { getProgramMarkdownComponents } from '../utils/markdownComponents';
import AttachmentList from './AttachmentList';
import ImageModal from './ImageModal';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import rehypeFigure from 'rehype-figure';
import { rehypePlugins } from '../utils/markdownUtils';
import Avatar from 'boring-avatars';

interface ReportHistoryItemProps {
    event: ReportEvent;
    reportDescription?: string;
    reportId?: string;
    accessToken?: string | null;
}

/**
 * Component for displaying a single item in the report history timeline.
 * Shows user avatar, name, action performed, and content when applicable.
 */
const ReportHistoryItem: React.FC<ReportHistoryItemProps> = ({
    event,
    reportDescription,
    reportId,
    accessToken
}) => {
    // State for image modal
    const [imageModal, setImageModal] = useState<{
        isOpen: boolean;
        src: string;
        alt?: string;
        downloadUrl?: string;
        accessToken?: string | null;
    }>({
        isOpen: false,
        src: '',
        alt: '',
        downloadUrl: '',
        accessToken: null
    });

    // Handle image click to open modal
    const handleImageClick = (src: string, alt?: string) => {
        // Extract attachment ID from URL
        const attachmentIdMatch = src.match(/\/attachments\/([^\/]+)\/download/);
        const attachmentId = attachmentIdMatch ? attachmentIdMatch[1] : null;

        let downloadUrl = '';
        if (attachmentId && reportId) {
            if (event.event_type === 'comment' && event.comment) {
                // Comment attachment
                downloadUrl = `/reports/${reportId}/comments/${event.comment.id}/attachments/${attachmentId}/download`;
            } else if (event.event_type === 'report_created') {
                // Report attachment
                downloadUrl = `/reports/${reportId}/attachments/${attachmentId}/download`;
            }
        }

        setImageModal({
            isOpen: true,
            src,
            alt,
            downloadUrl,
            accessToken
        });
    };

    // Handle modal close
    const handleModalClose = () => {
        setImageModal(prev => ({ ...prev, isOpen: false }));
    };

    // Format action text based on event type
    const getActionText = (event: ReportEvent) => {
        switch (event.event_type) {
            case 'report_created':
                return 'created this report';
            case 'status_change':
                return 'changed status from';
            case 'severity_change':
                return 'changed severity from';
            case 'comment':
                return 'added a comment';
            default:
                return 'performed an action';
        }
    };

    // Check if this event should show content
    const shouldShowContent = event.event_type === 'report_created' || event.event_type === 'comment';

    const currentAttachments = event.event_type === 'comment'
        ? event.comment?.attachments
        : (event.event_type === 'report_created' ? event.attachments : []);

    return (
        <div className="flex gap-4 p-4 border-b border-gray-200 last:border-b-0">
            {/* User Avatar */}
            <div className="flex-shrink-0">
                {event.user_avatar_url ? (
                    <img
                        src={`${import.meta.env.VITE_API_BASE_URL}${event.user_avatar_url}`}
                        alt={`${event.user_name || 'User'} avatar`}
                        className="w-10 h-10 rounded-full object-cover"
                    />
                ) : (
                    <Avatar
                        size={40}
                        name={event.user_name || 'User'}
                        variant="bauhaus"
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Header with user name and action */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-indigo-600">
                            {event.user_name || 'Unknown User'}
                        </span>
                        <span className="text-color-secondary">
                            {getActionText(event)}
                        </span>
                        {event.event_type === 'status_change' && (
                            <>
                                <StatusBadge status={event.old_value || ''} />
                                <span className="text-color-secondary">to</span>
                                <StatusBadge status={event.new_value || ''} />
                            </>
                        )}
                        {event.event_type === 'severity_change' && (
                            <>
                                <SeverityBadge severity={parseFloat(event.old_value || '0')} />
                                <span className="text-color-secondary">to</span>
                                <SeverityBadge severity={parseFloat(event.new_value || '0')} />
                            </>
                        )}
                    </div>
                    <span className="text-sm text-gray-500 flex-shrink-0">
                        {new Date(event.created_at).toLocaleString()}
                    </span>
                </div>

                {/* Content for reports and comments */}
                {shouldShowContent && (
                    <div className="bg-white rounded-lg">
                        {event.event_type === 'report_created' && (
                            <div className="text-sm text-gray-900">
                                {/* Report Description */}
                                <div className="mt-2 text-color-primary break-words markdown-content">
                                    <ReactMarkdown
                                        skipHtml={true}
                                        components={getProgramMarkdownComponents({ onImageClick: handleImageClick, accessToken })}
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={rehypePlugins}
                                    >
                                        {decode(reportDescription)}
                                    </ReactMarkdown>
                                </div>

                                <AttachmentList
                                    attachments={currentAttachments}
                                    accessToken={accessToken}
                                    contextUrl={reportId ? `${import.meta.env.VITE_API_BASE_URL}/reports/${reportId}` : undefined}
                                />
                            </div>
                        )}

                        {event.event_type === 'comment' && event.comment && (
                            <div>
                                <div className="text-color-primary break-words markdown-content">
                                    <ReactMarkdown
                                        skipHtml={true}
                                        components={getProgramMarkdownComponents({ onImageClick: handleImageClick, accessToken })}
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={rehypePlugins}
                                    >
                                        {decode(event.comment.content)}
                                    </ReactMarkdown>
                                </div>

                                <AttachmentList
                                    attachments={currentAttachments}
                                    accessToken={accessToken}
                                    contextUrl={reportId && event.comment ? `${import.meta.env.VITE_API_BASE_URL}/reports/${reportId}/comments/${event.comment.id}` : undefined}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Image Modal */}
            <ImageModal
                isOpen={imageModal.isOpen}
                onClose={handleModalClose}
                imageSrc={imageModal.src}
                imageAlt={imageModal.alt}
                downloadUrl={imageModal.downloadUrl}
                accessToken={imageModal.accessToken}
            />
        </div >
    );
};

export default ReportHistoryItem;
