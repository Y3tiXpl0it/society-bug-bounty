// src/pages/ProgramDetailPage.tsx
import React, { useEffect, useCallback, useMemo } from 'react'; // Agregamos useMemo
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import programService from '../services/programService';
import { generateBackgroundColor } from '../utils/colorHelper';
import { getInitials, formatReward } from '../utils/programHelper';
import { getProgramMarkdownComponents } from '../utils/markdownComponents';
import { getAssetTypeDisplayName } from '../utils/assetTypeHelper';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import rehypeFigure from 'rehype-figure';
import { rehypePlugins } from '../utils/markdownUtils';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Renders the public-facing detail page for a single bug bounty program.
 */
const ProgramDetailPage: React.FC = () => {
    const navigate = useNavigate();
    const { orgSlug, progSlug } = useParams<{
        orgSlug: string;
        progSlug: string;
    }>();

    const { accessToken, setAccessToken, isLoggedIn } = useAuth();

    // -------------------------------------------------------------------------
    // 1. Hook to fetch program details using useAsync
    // -------------------------------------------------------------------------
    
    // 1. Hook to fetch program details using useAsync
    const getProgramData = useCallback(async () => {
        if (!orgSlug || !progSlug) throw new Error("Missing parameters");
        return await programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
    }, [accessToken, orgSlug, progSlug, setAccessToken]);

    // 1. Hook to fetch program details using useAsync
    const asyncOptions = useMemo(() => ({
        onError: (err: any) => {
            const message = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to load program.';
            toast.error(message);
        }
    }), []);

    const { 
        data: program, 
        loading: isLoading, 
        error,
        execute: fetchProgram 
    } = useAsync(getProgramData, asyncOptions);

    useEffect(() => {
        fetchProgram();
    }, [fetchProgram]);

    // -------------------------------------------------------------------------
    // 2. Event Handlers
    // -------------------------------------------------------------------------
    const handleSubmitReportClick = () => {
        if (!isLoggedIn) {
            navigate('/login', { state: { message: 'You need to sign in or sign up before continuing.' } });
            return;
        }
        if (program) {
            navigate(`/programs/${program.organization.slug}/${program.slug}/submit-report`);
        } else {
            toast.error('Program details not available to submit a report.');
        }
    };

    // -------------------------------------------------------------------------
    // 3. Render Logic
    // -------------------------------------------------------------------------

    if (isLoading) {
        return <div className="text-center p-8">Loading Program...</div>;
    }

    if (error || !program) {
        return (
            <div className="text-center text-red-600 bg-red-100 p-4 rounded-md">
                {typeof error === 'string' ? error : 'Failed to load program details. It may not exist or is no longer available.'}
            </div>
        );
    }

    const sortedRewards = [...program.rewards].sort((a, b) => {
        const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
        const severityA = severityOrder[a.severity] || 0;
        const severityB = severityOrder[b.severity] || 0;
        return severityB - severityA;
    });

    return (
        <div className="bg-gray-50 min-h-screen py-8">
            <div className="max-w-screen-2xl mx-auto px-4">
                {/* --- PROGRAM HEADER --- */}
                <header className="bg-white shadow-lg rounded p-4 flex items-center space-x-4">
                    <div className="w-20 h-20 rounded-md flex-shrink-0">
                        {program.organization.logo_url ? (
                            <img
                                src={`${API_BASE_URL}${program.organization.logo_url}`}
                                alt={`${program.organization.name} logo`}
                                className="w-full h-full object-cover rounded-md"
                            />
                        ) : (
                            <div
                                className={`w-full h-full rounded-md flex items-center justify-center text-white text-2xl font-bold ${generateBackgroundColor(
                                    program.organization.name
                                )}`}
                            >
                                {getInitials(program.organization.name)}
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{program.name}</h1>
                        <p className="text-lg text-gray-500 mt-1">
                            Offered by <span className="font-semibold">{program.organization.name}</span>
                        </p>
                    </div>
                </header>

                {/* --- MAIN BODY (2-COLUMN LAYOUT) --- */}
                <main className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Column: Details & Assets */}
                    <div className="col-span-1 lg:col-span-3 bg-white shadow-lg rounded p-8">
                        <h2 className="text-xl font-bold border-b border-gray-300 pb-4">
                            Program Details
                        </h2>
                        <div className="mt-6 break-words markdown-content">
                            <ReactMarkdown 
                                skipHtml={true} 
                                components={getProgramMarkdownComponents()}
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={rehypePlugins} 
                            >
                                {program.description}
                            </ReactMarkdown>
                        </div>
                        <hr className="my-8 border-t border-gray-300" />
                        <h2 className="text-xl font-bold">In-Scope Assets</h2>
                        <ul className="mt-4 space-y-3">
                            {program.assets.map((asset) => (
                                <li key={asset.id} className="p-2 rounded border border-gray-300">
                                    <div>
                                        <p className="text-indigo-600 font-semibold break-all">
                                            <span className="bg-gray-200 px-2 py-0.5 rounded text-sm font-semibold text-color-primary mr-2 inline-block">
                                                {getAssetTypeDisplayName(asset.asset_type.name)}
                                            </span>
                                            {asset.identifier}
                                        </p>
                                        {asset.description && (
                                            <p
                                                className="text-sm text-gray-500 mt-2 break-words"
                                                style={{ whiteSpace: 'pre-line' }}
                                            >
                                                {asset.description}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right Column (Sidebar): Submit Button & Rewards */}
                    <aside className="space-y-8">
                        {/* --- SUBMIT REPORT BUTTON --- */}
                        <div className="bg-white shadow-lg rounded p-6">
                            <button
                                onClick={handleSubmitReportClick}
                                disabled={!program.is_active}
                                className={`w-full text-white font-bold py-3 px-4 rounded-md text-base transition-colors ${
                                    program.is_active
                                        ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                                        : 'bg-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {program.is_active ? 'Submit Report' : 'Program Inactive'}
                            </button>
                        </div>

                        {/* --- REWARDS SECTION --- */}
                        <div className="bg-white shadow-lg rounded p-8">
                            <h2 className="text-xl font-bold text-center">Rewards</h2>
                            <div className="mt-6 space-y-4">
                                {sortedRewards.map((reward) => (
                                    <div
                                        key={reward.severity}
                                        className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                                    >
                                        <span className="font-semibold capitalize text-color-primary">
                                            {reward.severity}
                                        </span>
                                        <span className="font-bold text-green-600 text-base">
                                            {formatReward([reward])}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
};

export default ProgramDetailPage;