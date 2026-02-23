// frontend/src/pages/LeaderboardPage.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import leaderboardService from '../services/leaderboardService';
import type { LeaderboardEntry } from '../types/leaderboardTypes';
import toast from 'react-hot-toast';

const LeaderboardPage: React.FC = () => {
    const { accessToken, setAccessToken } = useAuth();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const data = await leaderboardService.getLeaderboard(1, 50, accessToken, setAccessToken);
                setEntries(data.items);
            } catch (err) {
                console.error('Failed to fetch leaderboard:', err);
                toast.error('Failed to load leaderboard data.');
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

    const topThree = entries.slice(0, 3);
    const rest = entries.slice(3);

    // Helpers to re-order top 3 as: 2nd, 1st, 3rd for the podium visual
    const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
                        Leaderboard
                    </h1>
                    <p className="max-w-xl mx-auto text-xl text-gray-500">
                        Top hackers ranked by their total contribution score.
                    </p>
                </div>

                {/* Podium Section */}
                {topThree.length > 0 && (
                    <div className="flex flex-row justify-center items-end gap-4 sm:gap-6 mb-16 h-[320px]">
                        {podiumOrder.map((entry) => {
                            if (!entry) return null;
                            const isFirst = entry.rank === 1;
                            const isSecond = entry.rank === 2;

                            const heightClass = isFirst ? 'h-[240px]' : isSecond ? 'h-[200px]' : 'h-[160px]';
                            const shadowClass = isFirst ? 'shadow-xl border-yellow-400' : isSecond ? 'shadow-lg border-gray-300' : 'shadow-md border-orange-300';
                            const bgClass = isFirst ? 'bg-amber-50' : isSecond ? 'bg-gray-50/80' : 'bg-orange-50/50';

                            return (
                                <div key={entry.username} className={`flex flex-col items-center w-36 sm:w-48 transition-transform duration-300 hover:-translate-y-2`}>
                                    <div className="relative mb-4">
                                        <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 text-4xl drop-shadow-md z-20`}>
                                            {isFirst ? '🥇' : isSecond ? '🥈' : '🥉'}
                                        </div>
                                        <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-white shadow-md border-2 ${isFirst ? 'border-yellow-400' : isSecond ? 'border-gray-300' : 'border-orange-300'}`}>
                                            <div className="w-full h-full bg-gray-100 rounded-full overflow-hidden">
                                                {entry.avatar_url ? (
                                                    <img src={`${import.meta.env.VITE_API_BASE_URL}${entry.avatar_url}`} alt={entry.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-3xl font-bold bg-gray-200">
                                                        {entry.username.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`w-full flex flex-col items-center justify-start pt-5 px-3 rounded-t-xl border-t-4 border-l border-r ${heightClass} ${bgClass} ${shadowClass} bg-white`}>
                                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 truncate w-full text-center" title={entry.username}>{entry.username}</h3>
                                        <div className="text-2xl sm:text-3xl font-black text-indigo-600 mb-1">
                                            {entry.total_score}
                                        </div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Score</div>

                                        <div className="mt-auto mb-4 w-full px-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-red-600 font-medium">Critical:</span>
                                                <span className="text-gray-900 font-semibold">{entry.bug_breakdown.critical}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-orange-500 font-medium">High:</span>
                                                <span className="text-gray-900 font-semibold">{entry.bug_breakdown.high}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* List Section */}
                {rest.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Rank</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hacker</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Reports</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Breakdown</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {rest.map((entry) => (
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
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium" title="Critical Bugs">
                                                        {entry.bug_breakdown.critical} C
                                                    </span>
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium" title="High Bugs">
                                                        {entry.bug_breakdown.high} H
                                                    </span>
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs font-medium" title="Medium Bugs">
                                                        {entry.bug_breakdown.medium} M
                                                    </span>
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium" title="Low Bugs">
                                                        {entry.bug_breakdown.low} L
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
                        <p className="text-gray-600 text-lg">No hackers have made it to the leaderboard yet.</p>
                        <p className="text-gray-500 mt-2">Submit valid vulnerability reports to secure your spot!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeaderboardPage;
