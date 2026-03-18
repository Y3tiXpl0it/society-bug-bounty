// src/pages/ProgramDetailPage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import { generateBackgroundColor } from '../utils/colorHelper';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
import { getInitials } from '../utils/programHelper';
import { getProgramMarkdownComponents } from '../utils/markdownComponents';
import { getAssetTypeDisplayName } from '../utils/assetTypeHelper';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import rehypeFigure from 'rehype-figure';
import { rehypePlugins } from '../utils/markdownUtils';
import { AsyncContent } from '../components/AsyncContent';

/**
 * Renders the public-facing detail page for a single bug bounty program.
 * Refactored to use TanStack Query instead of useAsync.
 */
const ProgramDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { orgSlug, progSlug } = useParams<{
        orgSlug: string;
        progSlug: string;
    }>();

    const { accessToken, setAccessToken, isLoggedIn } = useAuth();

    // -------------------------------------------------------------------------
    // 1. Data Fetching (TanStack Query)
    // -------------------------------------------------------------------------

    const {
        data: program,
        isLoading,
        error
    } = useQuery({
        queryKey: ['program', orgSlug, progSlug, accessToken],
        queryFn: () => {
            if (!orgSlug || !progSlug) throw new Error(t('programDetail.missingParameters'));
            return programService.getProgramBySlug(accessToken, orgSlug, progSlug, setAccessToken);
        },
        // Only run the query if we have the slugs
        enabled: !!orgSlug && !!progSlug,
    });

    // -------------------------------------------------------------------------
    // 2. Event Handlers
    // -------------------------------------------------------------------------

    const handleSubmitReportClick = () => {
        if (!isLoggedIn) {
            navigate('/login', { state: { message: t('programDetail.loginRequired') } });
            return;
        }
        if (program) {
            navigate(`/programs/${program.organization.slug}/${program.slug}/submit-report`);
        } else {
            toast.error(t('programDetail.detailsUnavailable'));
        }
    };

    // -------------------------------------------------------------------------
    // 3. Render Logic
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------

    return (
        <AsyncContent
            loading={isLoading}
            error={error}
            data={program}
            minLoadingTime={300}
        >
            {program && (
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
                                    {t('programDetail.offeredBy')} <span className="font-semibold">{program.organization.name}</span>
                                </p>
                            </div>
                        </header>

                        {/* --- MAIN BODY (2-COLUMN LAYOUT) --- */}
                        <main className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* Left Column: Details & Assets */}
                            <div className="col-span-1 lg:col-span-3 bg-white shadow-lg rounded p-8">
                                <h2 className="text-xl font-bold border-b border-gray-300 pb-4">
                                    {t('programDetail.details')}
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
                                <h2 className="text-xl font-bold">{t('programDetail.assets')}</h2>
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
                                        className={`w-full text-white font-bold py-3 px-4 rounded-md text-base transition-colors ${program.is_active
                                            ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                                            : 'bg-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        {program.is_active ? t('programDetail.submitReport') : t('programDetail.programInactive')}
                                    </button>
                                </div>

                                {/* --- REWARDS SECTION --- */}
                                <div className="bg-white shadow-lg rounded p-8">
                                    <h2 className="text-xl font-bold text-center">{t('programDetail.rewards')}</h2>
                                    <div className="mt-6 space-y-4">
                                        {[
                                            { severity: 'critical', amount: program.reward_critical },
                                            { severity: 'high', amount: program.reward_high },
                                            { severity: 'medium', amount: program.reward_medium },
                                            { severity: 'low', amount: program.reward_low },
                                        ].map((reward) => (
                                            <div
                                                key={reward.severity}
                                                className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                                            >
                                                <span className="font-semibold capitalize text-color-primary">
                                                    {reward.severity}
                                                </span>
                                                <span className="font-bold text-green-600 text-base">
                                                    {(reward.amount > 0) ? `$${reward.amount.toLocaleString()}` : '$0'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </aside>
                        </main>
                    </div>
                </div>
            )}
        </AsyncContent>
    );
};

export default ProgramDetailPage;