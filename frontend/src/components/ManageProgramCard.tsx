// src/components/ManageProgramCard.tsx
import React from "react";
import { useTranslation } from 'react-i18next';
import type { ProgramSummary } from "../types/programTypes";
import { generateBackgroundColor } from "../utils/colorHelper";
import { getInitials, formatReward } from "../utils/programHelper"; // Import shared helpers

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ManageProgramCardProps {
    program: ProgramSummary;
    onEdit: (program: ProgramSummary) => void;
    onViewReports: (program: ProgramSummary) => void;
}

/**
 * Renders a card for managing a bug bounty program.
 * This is used on the organization's private "Manage Programs" page.
 */
const ManageProgramCard: React.FC<ManageProgramCardProps> = ({
    program,
    onEdit,
    onViewReports,
}) => {
    const { t } = useTranslation();
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
                                program.organization.name
                            )}`}
                        >
                            {getInitials(program.organization.name)}
                        </div>
                    )}
                </div>

                {/* --- Column 2: Main Content (Flexible) --- */}
                <div className="flex-grow min-w-0 flex justify-between items-center">
                    {/* Left side of the content column (Text) */}
                    <div className="min-w-0 pr-4">
                        <h2 className="text-lg font-semibold truncate">
                            <span className="font-normal text-gray-500">
                                {program.organization.name}
                            </span>
                            <span className="mx-1 text-gray-300">|</span>
                            <span>{program.name}</span>
                        </h2>
                        <p className="text-sm font-semibold text-green-600 mt-1">
                            {formatReward(program.rewards)}
                        </p>
                    </div>
                    {/* Right side of the content column (Action Button & Status) */}
                    <div className="flex-shrink-0 flex flex-col items-end">
                        <span
                            className={`mb-2 px-3 py-1 text-sm font-semibold rounded-full ${program.is_active
                                    ? "bg-green-200 text-green-800"
                                    : "bg-red-200 text-red-800"
                                }`}
                        >
                            {program.is_active ? t('components.manageProgramCard.active') : t('components.manageProgramCard.inactive')}
                        </span>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => onViewReports(program)}
                                className="bg-indigo-200 hover:bg-indigo-300 text-indigo-700 font-bold py-1 px-3 rounded-md transition duration-300 text-sm cursor-pointer"
                            >
                                {t('components.manageProgramCard.viewReports')}
                            </button>
                            <button
                                onClick={() => onEdit(program)}
                                className="bg-gray-200 hover:bg-gray-300 text-color-primary font-bold py-1 px-3 rounded-md transition duration-300 text-sm cursor-pointer"
                            >
                                {t('components.manageProgramCard.editProgram')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageProgramCard;
