// frontend/src/types/commonTypes.ts

/**
 * Represents an Organization object as returned by the API.
 */
export interface Organization {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
}

/**
 * Represents an attachment (file/image) on any entity (reports, comments, programs, etc.).
 * Based on AttachmentResponse schema from the backend.
 */
export interface Attachment {
    id: string;
    entity_type: string; // e.g., 'report', 'report_comment', 'program'
    entity_id: string;
    uploader_id: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    created_at: string;
}