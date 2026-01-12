import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorHelpers';

interface UseAsyncOptions<T> {
    onSuccess?: (data: T) => void;
    onError?: (message: string) => void;
    showToastError?: boolean; // Por defecto true
}

export const useAsync = <T, args extends any[] = any[]>(
    asyncFunction: (...args: args) => Promise<T>,
    options: UseAsyncOptions<T> = {}
) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (...args: args) => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await asyncFunction(...args);
            setData(result);
            if (options.onSuccess) options.onSuccess(result);
            return result;
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            
            if (options.showToastError !== false) {
                toast.error(message);
            }
            
            if (options.onError) options.onError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [asyncFunction, options]);

    return { execute, data, loading, error };
};