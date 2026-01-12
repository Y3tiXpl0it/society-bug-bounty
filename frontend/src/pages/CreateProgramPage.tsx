// src/pages/CreateProgramPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import type { ProgramCreateData, ProgramBulkUpdateData } from '../types/programTypes';

/**
 * Renders the page for creating a new bug bounty program.
 * This component acts as a "container" or "wrapper". It utilizes the generic
 * ProgramForm for the UI and state management, and is responsible for handling
 * the final submission logic.
 */
const CreateProgramPage: React.FC = () => {
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<ProgramCreateData | null>(null);
    const { accessToken, setAccessToken } = useAuth();

    // hook to handle program creation
    const { execute: createProgram, loading: isSubmitting } = useAsync(
        async (data: ProgramCreateData) => {
            return await programService.createProgram(accessToken, data, setAccessToken);
        },
        {
            onSuccess: () => {
                toast.success('Program created successfully!');
                navigate('/programs');
            },
            showToastError: true 
        }
    );

    // Handles the form submission from ProgramForm.
    const handleCreateProgram = async (formData: ProgramCreateData | ProgramBulkUpdateData) => {
        setPendingFormData(formData as ProgramCreateData);
        setShowConfirm(true);
    };

    // Confirms the submission and proceeds to create the program.
    const confirmSubmit = async () => {
        if (pendingFormData) {
            setShowConfirm(false);
            await createProgram(pendingFormData);
            setPendingFormData(null);
        }
    };

    /**
     * Cancels the confirmation dialog.
     */
    const cancelSubmit = () => {
        setShowConfirm(false);
        setPendingFormData(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">Create a New Program</h1>

                <ProgramForm
                    onSubmit={handleCreateProgram}
                    isSubmitting={isSubmitting}
                    submitButtonText="Create Program"
                />

                <ConfirmationModal
                    isOpen={showConfirm}
                    title="Confirm Program Creation"
                    message="Are you sure you want to create this program?"
                    onConfirm={confirmSubmit}
                    onCancel={cancelSubmit}
                    confirmText="Create Program"
                    cancelText="Cancel"
                    isLoading={isSubmitting}
                />
            </div>
        </div>
    );
};

export default CreateProgramPage;
