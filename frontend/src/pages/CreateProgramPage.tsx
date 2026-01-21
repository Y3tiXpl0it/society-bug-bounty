// src/pages/CreateProgramPage.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import programService from '../services/programService';
import ProgramForm from '../components/ProgramForm';
import ConfirmationModal from '../components/ConfirmationModal';
import { AsyncContent } from '../components/AsyncContent';
import type { ProgramCreateData, ProgramBulkUpdateData } from '../types/programTypes';

// Definimos opciones por defecto constantes para evitar recreación de objetos
const DEFAULT_FETCH_OPTIONS = {};

/**
 * Renders the page for creating a new bug bounty program.
 * Refactored to use AsyncContent for loading states and optimized hooks.
 */
const CreateProgramPage: React.FC = () => {
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingFormData, setPendingFormData] = useState<ProgramCreateData | null>(null);
    const { accessToken, setAccessToken } = useAuth();

    // -------------------------------------------------------------------------
    // 1. Hook to FETCH initial data (organizations/programs)
    // -------------------------------------------------------------------------
    
    const fetchOrgsCall = useCallback(async () => {
        return await programService.getMyPrograms(accessToken, setAccessToken); 
    }, [accessToken, setAccessToken]);

    const { 
        execute: loadOrgs, 
        loading: loadingOrgs, 
        error: errorOrgs, 
        data: organizations 
    } = useAsync(fetchOrgsCall, DEFAULT_FETCH_OPTIONS);

    useEffect(() => {
        loadOrgs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // -------------------------------------------------------------------------
    // 2. Hook TO CREATE program
    // -------------------------------------------------------------------------
    
    const createProgramCall = useCallback(async (data: ProgramCreateData) => {
        return await programService.createProgram(accessToken, data, setAccessToken);
    }, [accessToken, setAccessToken]);

    const asyncOptions = useMemo(() => ({
        onSuccess: () => {
            toast.success('Program created successfully!');
            navigate('/programs');
        },
        showToastError: true
    }), [navigate]);

    const { execute: createProgram, loading: isSubmitting } = useAsync(
        createProgramCall,
        asyncOptions
    );

    // -------------------------------------------------------------------------
    // 3. Handlers
    // -------------------------------------------------------------------------
    
    const handleCreateProgram = useCallback(async (formData: ProgramCreateData | ProgramBulkUpdateData) => {
        setPendingFormData(formData as ProgramCreateData);
        setShowConfirm(true);
    }, []);

    const confirmSubmit = async () => {
        if (pendingFormData) {
            setShowConfirm(false); 
            await createProgram(pendingFormData);
            setPendingFormData(null);
        }
    };

    const cancelSubmit = () => {
        setShowConfirm(false);
        setPendingFormData(null);
    };

    // -------------------------------------------------------------------------
    // 4. Render
    // -------------------------------------------------------------------------
    
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold mb-6">Create a New Program</h1>

                {/* AsyncContent wraps the form to ensure basic data is loaded before interaction */}
                <AsyncContent
                    loading={loadingOrgs}
                    error={errorOrgs}
                    data={organizations}
                    minLoadingTime={300}
                >
                    <ProgramForm
                        onSubmit={handleCreateProgram}
                        isSubmitting={isSubmitting}
                        submitButtonText="Create Program"
                    />
                </AsyncContent>

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