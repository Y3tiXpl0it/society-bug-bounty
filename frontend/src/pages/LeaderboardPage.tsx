// frontend/src/pages/LeaderboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import leaderboardService from '../services/leaderboardService';
import type { LeaderboardEntry } from '../types/leaderboardTypes';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const LeaderboardPage: React.FC = () => {
    const { accessToken, setAccessToken } = useAuth();
    const { t } = useTranslation();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const data = await leaderboardService.getLeaderboard(1, 100, accessToken, setAccessToken);
                setEntries(data.items);
            } catch (err) {
                console.error('Failed to fetch leaderboard:', err);
                toast.error(t('leaderboard.apiError'));
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [accessToken, setAccessToken]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex justify-center items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
                        {t('leaderboard.title')}
                    </h1>
                    <p className="max-w-xl mx-auto text-xl text-gray-500">
                        {t('leaderboard.subtitle')}
                    </p>
                </div>

                {/* List Section */}
                {entries.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">{t('leaderboard.headers.rank')}</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('leaderboard.headers.hacker')}</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('leaderboard.headers.score')}</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">{t('leaderboard.headers.reports')}</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">{t('leaderboard.headers.breakdown')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {entries.map((entry) => (
                                        <tr key={entry.username} className="hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-block w-8 text-lg font-bold text-gray-400">
                                                    #{entry.rank}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                                        {entry.avatar_url ? (
                                                            <img src={`${import.meta.env.VITE_API_BASE_URL}${entry.avatar_url}`} alt={entry.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm font-bold bg-gray-200">
                                                                {entry.username.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-semibold text-gray-900">{entry.username}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="font-mono text-lg font-bold text-indigo-600">{entry.total_score}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell text-center">
                                                <span className="text-gray-600 font-medium">{entry.total_reports}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell text-center">
                                                <div className="flex gap-2 justify-center">
                                                    <span className="px-2 py-1 bg-red-200 text-red-800 rounded-md text-xs font-medium" title={t('leaderboard.bugTypes.critical')}>
                                                        {entry.bug_breakdown.critical} {t('leaderboard.bugTypes.c')}
                                                    </span>
                                                    <span className="px-2 py-1 bg-orange-200 text-orange-800 rounded-md text-xs font-medium" title={t('leaderboard.bugTypes.high')}>
                                                        {entry.bug_breakdown.high} {t('leaderboard.bugTypes.h')}
                                                    </span>
                                                    <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-md text-xs font-medium" title={t('leaderboard.bugTypes.medium')}>
                                                        {entry.bug_breakdown.medium} {t('leaderboard.bugTypes.m')}
                                                    </span>
                                                    <span className="px-2 py-1 bg-green-200 text-green-800 rounded-md text-xs font-medium" title={t('leaderboard.bugTypes.low')}>
                                                        {entry.bug_breakdown.low} {t('leaderboard.bugTypes.l')}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {entries.length === 0 && (
                    <div className="text-center py-20 bg-white shadow rounded-lg px-6">
                        <p className="text-gray-600 text-lg">{t('leaderboard.emptyState.title')}</p>
                        <p className="text-gray-500 mt-2">{t('leaderboard.emptyState.subtitle')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeaderboardPage;
