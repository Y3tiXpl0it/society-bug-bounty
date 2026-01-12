// frontend/src/components/ImageModal.tsx
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import axios from 'axios';
import type { Attachment } from '../types/commonTypes';
import { imageCache } from '../utils/markdownComponents';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    imageAlt?: string;
    downloadUrl?: string;
    accessToken?: string | null;
}

/**
 * Modal component for displaying enlarged images.
 * Features overlay background, centered image, and close functionality.
 */
const ImageModal: React.FC<ImageModalProps> = ({
    isOpen,
    onClose,
    imageSrc,
    imageAlt = 'Enlarged image',
    downloadUrl,
    accessToken,
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [modalImageSrc, setModalImageSrc] = useState<string>(imageSrc);
    const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
    const [imageStyle, setImageStyle] = useState<React.CSSProperties>({});

    // Fetch authenticated image when modal opens
    useEffect(() => {
        if (!isOpen) return; // No need to fetch if modal is closed

        // Check cache first
        if (imageCache.has(imageSrc)) {
            setModalImageSrc(imageCache.get(imageSrc)!);
            setIsLoadingImage(false);
            return;
        }

        if (isOpen && imageSrc.includes('/attachments/') && imageSrc.includes('/download')) {
            setIsLoadingImage(true);
            const fetchImage = async () => {
                try {
                    const fullUrl = imageSrc.startsWith('http') ? imageSrc : `${API_BASE_URL}${imageSrc}`;

                    // Use the provided accessToken or fall back to localStorage
                    const tokenToUse = accessToken || localStorage.getItem('access_token');

                    const response = await axios.get(fullUrl, {
                        headers: {
                            Authorization: `Bearer ${tokenToUse}`,
                        },
                        responseType: 'blob',
                    });
                    if (response.status === 200) {
                        const blob = response.data;
                        const objectUrl = URL.createObjectURL(blob);
                        imageCache.set(imageSrc, objectUrl);
                        setModalImageSrc(objectUrl);
                    }
                } catch (err) {
                    console.error('Error fetching modal image:', err);
                } finally {
                    setIsLoadingImage(false);
                }
            };
            fetchImage();
        } else {
            setModalImageSrc(imageSrc);
            setIsLoadingImage(false);
        }
    }, [isOpen, imageSrc, accessToken]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Handle download with authentication
    const handleDownload = async () => {
        if (!downloadUrl) {
            return;
        }

        setIsDownloading(true);
        try {
            // Extract IDs from downloadUrl to get attachment info
            const urlMatch = downloadUrl.match(
                /\/reports\/([^\/]+)\/(?:comments\/([^\/]+)\/)?attachments\/([^\/]+)\/download/
            );
            if (!urlMatch) {
                throw new Error('Invalid download URL format');
            }

            const reportId = urlMatch[1];
            const commentId = urlMatch[2];
            const attachmentId = urlMatch[3];

            let infoUrl;
            if (commentId) {
                infoUrl = `/reports/${reportId}/comments/${commentId}/attachments`;
            } else {
                infoUrl = `/reports/${reportId}/attachments`;
            }

            const infoResponse = await apiFetch(infoUrl, accessToken || null);
            const attachments = infoResponse.data;
            const attachment = attachments.find((att: Attachment) => att.id === attachmentId);
            const filename = attachment ? attachment.file_name : 'download';

            // Now download the file
            const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE_URL}${downloadUrl}`;
            const response = await axios.get(fullUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'blob',
            });

            if (response.status !== 200) {
                throw new Error('Failed to download file');
            }

            const blob = response.data;

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download image');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const naturalRatio = img.naturalWidth / img.naturalHeight;
        const containerRatio = window.innerWidth / window.innerHeight;

        // Si la imagen es más "ancha" que la pantalla (relativamente)
        if (naturalRatio > containerRatio) {
            setImageStyle({ width: '100%', height: 'auto' });
        } else {
            // Si la imagen es más "alta" que la pantalla
            setImageStyle({ width: 'auto', height: '100%' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            {/* Action buttons */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                {/* Download button */}
                <button
                    onClick={handleDownload}
                    disabled={isDownloading || !downloadUrl}
                    className="text-white hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Download image"
                >
                    {isDownloading ? (
                        <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                    ) : (
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    )}
                </button>

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="text-white hover:text-gray-300 transition-colors cursor-pointer"
                    aria-label="Close modal"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Image container */}
            <div 
                className="relative flex items-center justify-center p-4"
                style={{ width: '90vw', height: '90vh' }}
            >
                {isLoadingImage ? (
                    <div
                        className="flex items-center justify-center h-full w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="text-gray-500">Loading image...</span>
                    </div>
                ) : (
                    <img
                        src={modalImageSrc}
                        alt={imageAlt}
                        onLoad={handleImageLoad}
                        style={imageStyle}
                        className="object-contain rounded-lg drop-shadow-2xl transition-all duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </div>
    );
};

export default ImageModal;
