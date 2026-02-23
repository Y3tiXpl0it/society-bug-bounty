// frontend/src/services/leaderboardService.ts
import { apiGet } from '../utils/apiClient';
import type { LeaderboardResponse } from '../types/leaderboardTypes';

const getLeaderboard = async (
    page: number = 1,
    size: number = 20,
    accessToken?: string | null,
    onTokenRefresh?: (newToken: string) => void
): Promise<LeaderboardResponse> => {
    return apiGet(`/users/leaderboard?page=${page}&size=${size}`, accessToken || null, onTokenRefresh);
};

const leaderboardService = {
    getLeaderboard,
};

export default leaderboardService;
