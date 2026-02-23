// frontend/src/types/leaderboardTypes.ts

export interface LeaderboardBugBreakdown {
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export interface LeaderboardEntry {
    username: string;
    avatar_url: string | null;
    rank: number;
    total_score: number;
    total_reports: number;
    bug_breakdown: LeaderboardBugBreakdown;
}

export interface LeaderboardResponse {
    items: LeaderboardEntry[];
    total: number;
    page: number;
    size: number;
}
