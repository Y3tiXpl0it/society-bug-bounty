// frontend/src/utils/markdownComponents.tsx
import React, { useEffect, useState } from 'react';
import type { Components } from 'react-markdown';
import axios from 'axios';

interface MarkdownComponentsProps {
    onImageClick?: (src: string, alt?: string) => void;
    accessToken?: string | null;
}

// Global cache for fetched images to prevent re-fetching
export const imageCache = new Map<string, string>();

// Component to handle authenticated image fetching
const AuthenticatedImage: React.FC<{
    src: string;
    alt?: string;
    onClick?: () => void;
    className?: string;
    accessToken?: string | null;
}> = ({ src, alt, onClick, className, accessToken }) => {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        // Check cache first
        if (imageCache.has(src)) {
            setImageSrc(imageCache.get(src)!);
            setLoading(false);
            return;
        }
        const fetchImage = async () => {
            try {
                // Check if it's an attachment URL that needs auth
                if (src.includes('/attachments/') && src.includes('/download')) {
                    const response = await axios.get(src, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        responseType: 'blob',
                    });
                    if (response.status === 200) {
                        const blob = response.data;
                        const objectUrl = URL.createObjectURL(blob);
                        imageCache.set(src, objectUrl); // Cache the result
                        setImageSrc(objectUrl);
                    } else {
                        setError(true);
                    }
                } else {
                    // For non-attachment images, use src directly
                    setImageSrc(src);
                }
            } catch (err) {
                console.error('Error fetching image:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchImage();

        // Cleanup object URL on unmount (but keep in cache)
        return () => {
            // Don't revoke here since it's cached
        };
    }, [src, accessToken]);

    if (loading) {
        return (
            <span className={`${className} inline-block bg-gray-200 animate-pulse rounded align-middle`}>
                <span className="text-gray-500 text-sm">Loading...</span>
            </span>
        );
    }

    if (error) {
        return (
            <span className={`${className} inline-block bg-gray-200 rounded align-middle`}>
                <span className="text-gray-500 text-sm">Failed to load</span>
            </span>
        );
    }

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            onClick={onClick}
        />
    );
};

export const getProgramMarkdownComponents = (props?: MarkdownComponentsProps): Components => ({
    h1: ({ children }) => <h1 style={{borderBottom: 'none', paddingLeft: 0, marginBottom: '0.5rem'}} className="text-xl font-bold text-color-primary">{children}</h1>,
    h2: ({ children }) => <h2 style={{borderBottom: 'none', paddingLeft: 0, marginBottom: '0.5rem'}} className="text-lg font-bold text-color-primary">{children}</h2>,
    h3: ({ children }) => <h3 style={{borderBottom: 'none', paddingLeft: 0, marginBottom: '0.5rem'}} className="text-base font-bold text-color-primary">{children}</h3>,
    h4: ({ children }) => <h4 style={{borderBottom: 'none', paddingLeft: 0, marginBottom: '0.5rem'}} className="text-sm font-bold text-color-primary">{children}</h4>,
    h5: ({ children }) => <h5 style={{borderBottom: 'none', paddingLeft: 0, marginBottom: '0.5rem'}} className="text-sm font-bold text-color-primary">{children}</h5>,
    h6: ({ children }) => <h6 style={{borderBottom: 'none', paddingLeft: 0, marginBottom: '0.5rem'}} className="text-sm font-bold text-color-primary">{children}</h6>,
    p: ({ children }) => <p className="mb-4 text-color-primary leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="list-disc ml-6 mb-4 text-color-primary">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 text-color-primary">{children}</ol>,
    li: ({ children }) => <li className="mb-2">{children}</li>,
    a: ({ children, href }) => (
        <a href={href} className="text-blue-600 hover:text-blue-800 underline">
            {children}
        </a>
    ),
    blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4 bg-gray-50 py-2 rounded-r">
            {children}
        </blockquote>
    ),
    u: ({ children }) => <u className="underline decoration-solid">{children}</u>,
    del: ({ children }) => <del className="line-through text-gray-500">{children}</del>,
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
    pre: ({ children }) => <pre className="bg-gray-100 p-4 rounded overflow-x-auto mb-4">{children}</pre>,
    img: ({ src, alt }) => (
        <AuthenticatedImage
            src={src || ''}
            alt={alt}
            className="max-w-full h-auto max-h-[32rem] object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => props?.onImageClick?.(src || '', alt)}
            accessToken={props?.accessToken}
        />
    ),
    hr: () => null,
    table: ({ children }) => (
        <div className="overflow-x-auto mb-4 border border-gray-200 rounded w-fit max-w-full">
            <table className="divide-y divide-gray-200 text-left w-full"> 
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>,
    tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
    th: ({ children }) => (
        <th className="px-4 py-3 font-bold text-color-primary whitespace-nowrap border-r border-gray-200 last:border-r-0 bg-gray-100">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="px-4 py-3 text-color-primary whitespace-nowrap border-r border-gray-200 last:border-r-0">
            {children}
        </td>
    ),
});
