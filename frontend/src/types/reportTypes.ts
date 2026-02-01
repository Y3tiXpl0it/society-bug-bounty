// src/types/reportTypes.ts
import type { Asset, ProgramSummary } from './programTypes';
import type { Attachment } from './commonTypes';

/**
 * Payload required to create a new report.
 * Based on ReportCreateRequest schema from the backend.
 */
export interface ReportCreatePayload {
    title: string;
    description: string;
    reproduction_steps: string;
    impact: string;
    severity: number;
    asset_ids: string[]; // UUIDs of selected assets
}

/**
 * Represents the full report object returned by the API.
 * Based on ReportResponse schema from the backend.
 */
export interface Report {
    id: string; // uuid
    program_id: string; // uuid
    hacker_id: string; // uuid
    hacker_name: string;
    title: string;
    description: string;
    status: 'received' | 'in_review' | 'accepted' | 'rejected' | 'duplicate' | 'out_of_scope' | 'resolved';
    severity: number | null;
    created_at: string; // datetime
    updated_at: string; // datetime
    program: ProgramSummary;
    assets: Asset[];
    attachments: Attachment[];
}

/**
 * Represents a summary of a report for listing in cards.
 * Based on ReportSummary schema from the backend.
 */
export interface ReportSummary {
    id: string; // uuid
    title: string;
    status: 'received' | 'in_review' | 'accepted' | 'rejected' | 'duplicate' | 'out_of_scope' | 'resolved';
    severity: number | null;
    hacker_name: string;
    created_at: string; // datetime
}

/**
 * Represents a paginated response of report summaries.
 * Based on PaginatedReportSummaryResponse schema from the backend.
 */
export interface PaginatedReportSummaryResponse {
    total: number;
    reports: ReportSummary[];
}

/**
 * Represents a minimal report summary for my reports listing.
 * Based on ReportMyReportsSummary schema from the backend.
 */
export interface ReportMyReportsSummary {
    id: string;
    title: string;
    program_name: string;
    organization_name: string;
    status: 'received' | 'in_review' | 'accepted' | 'rejected' | 'duplicate' | 'out_of_scope' | 'resolved';
    severity: number | null;
    created_at: string;
    updated_at: string;
}

/**
 * Represents a comment on a report.
 * Based on ReportCommentResponse schema from the backend.
 */
export interface ReportComment {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    attachments?: Attachment[];
}


/**
 * Represents an event in the report history.
 * Based on ReportEventResponse schema from the backend.
 */
export interface ReportEvent {
    id: string;
    event_type: 'report_created' | 'status_change' | 'severity_change' | 'comment';
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    user_name: string | null;
    user_avatar_url: string | null;
    comment: ReportComment | null;
    attachments?: Attachment[];
}
