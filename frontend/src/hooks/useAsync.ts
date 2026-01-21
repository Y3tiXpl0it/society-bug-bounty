import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../utils/errorHelpers';

interface UseAsyncOptions<T, E = Error> {
    onSuccess?: (data: T) => void;
    onError?: (error: E) => void;
    showToastError?: boolean;
}

export const useAsync = <T, E = Error, args extends any[] = any[]>(
    asyncFunction: (...args: args) => Promise<T>,
    options: UseAsyncOptions<T, E> = {}
) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<E | null>(null);

    const execute = useCallback(async (...args: args) => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await asyncFunction(...args);
            setData(result);
            if (options.onSuccess) options.onSuccess(result);
            return result;
        } catch (err) {
            const errorObj = err as E;
            setError(errorObj);

            const message = getErrorMessage(err);
            
            if (options.showToastError !== false) {
                toast.error(message);
            }
            
            if (options.onError) options.onError(errorObj);
            return null;
        } finally {
            setLoading(false);
        }
    }, [asyncFunction, options]);

    return { execute, data, loading, error };
};