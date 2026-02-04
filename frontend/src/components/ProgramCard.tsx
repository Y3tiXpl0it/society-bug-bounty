// src/components/ProgramCard.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ProgramSummary } from '../types/programTypes';
import { generateBackgroundColor } from '../utils/colorHelper';
import { getInitials, formatReward } from '../utils/programHelper'; // Import shared helpers

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ProgramCardProps {
    program: ProgramSummary;
}

/**
 * Renders a card for a public bug bounty program.
 * This is used on the main program listing page.
 */
const ProgramCard: React.FC<ProgramCardProps> = ({ program }) => {
    const { t } = useTranslation();
    const programUrl = `/programs/${program.organization.slug}/${program.slug}`;

    return (
        <div className="bg-white border border-gray-200 rounded p-4 transition-shadow hover:shadow-lg">
            {/* Main container using Flexbox for a two-column layout: [Logo | Content] */}
            <div className="flex items-center space-x-4">
                {/* --- Column 1: Logo or Initials (Fixed Size) --- */}
                <div className="w-16 h-16 rounded-md flex-shrink-0">
                    {program.organization.logo_url ? (
                        <img
                            src={`${API_BASE_URL}${program.organization.logo_url}`}
                            alt={`${program.organization.name} logo`}
                            className="w-full h-full object-cover rounded-md"
                        />
                    ) : (
                        <div
                            className={`w-full h-full rounded-md flex items-center justify-center text-white text-2xl font-bold ${generateBackgroundColor(
                                program.organization.name,
                            )}`}
                        >
                            {getInitials(program.organization.name)}
                        </div>
                    )}
                </div>

                {/* --- Column 2: Main Content (Flexible) --- */}
                {/* 'min-w-0' is crucial for enabling text truncation in a flex container. */}
                <div className="flex-grow min-w-0 flex justify-between items-center">
                    {/* Left side of the content column (Text) */}
                    <div className="min-w-0 pr-4">
                        <h2 className="text-lg font-semibold truncate">
                            <span className="font-normal">{program.organization.name}</span>
                            <span className="mx-1 text-gray-300">|</span>
                            <Link to={programUrl} className="hover:text-blue-600 hover:underline">
                                {program.name}
                            </Link>
                        </h2>
                        <p className="text-sm font-semibold text-green-600 mt-1">{formatReward(program.rewards)}</p>
                    </div>
                    {/* Right side of the content column (Action Button) */}
                    <div className="flex-shrink-0">
                        <Link
                            to={programUrl}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-md transition duration-300 h-10 flex items-center justify-center"
                        >
                            {t('components.programCard.viewProgram')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramCard;
