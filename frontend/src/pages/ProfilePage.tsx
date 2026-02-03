import React, { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import userService from '../services/userService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { AsyncContent } from '../components/AsyncContent';
import Avatar from 'boring-avatars';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Validation schema with Zod
const profileSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters long')
        .max(24, 'Username must be no more than 24 characters long')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, underscores, hyphens, and dots')
        .refine(val => !['admin', 'root', 'administrator', 'support', 'info'].includes(val.toLowerCase()), 'This username is reserved and cannot be used'),
    profile_info: z.string().max(500, 'Profile info must be at most 500 characters long'),
});

const ProfilePage: React.FC = () => {
    // Get authentication state and hooks from useAuth
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading, refreshUser } = useAuth();

    // Local state for UI
    const [isEditing, setIsEditing] = useState(false);

    // Initialize form.
    const [formData, setFormData] = useState({
        username: user?.details?.username || '',
        profile_info: user?.details?.profile_info || '',
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Avatar upload states
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Modal states
    const [showAvatarConfirm, setShowAvatarConfirm] = useState(false);
    const [showProfileConfirm, setShowProfileConfirm] = useState(false);

    // -------------------------------------------------------------------------
    // 1. Mutations (TanStack Query)
    // -------------------------------------------------------------------------

    // Mutation for Avatar Upload
    const { mutate: uploadAvatar, isPending: isUploadingAvatar } = useMutation({
        mutationFn: async () => {
            if (!avatarFile || !accessToken) throw new Error("Missing file or token");
            return await userService.uploadAvatar(accessToken, avatarFile, setAccessToken);
        },
        onSuccess: async () => {
            await refreshUser();
            toast.success('Profile picture updated successfully');
            // Clear local state
            setAvatarFile(null);
            setPreviewUrl(null);
            // Close modal only on success
            setShowAvatarConfirm(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (error: any) => {
            console.error('Error uploading avatar:', error);
            const msg = error.response?.data?.detail || 'Error updating profile picture';
            toast.error(msg);
            setPreviewUrl(null);
            // Modal stays open so user can retry or cancel manually
        }
    });

    // Mutation for Profile Details Update
    const { mutate: updateProfile, isPending: isUpdatingProfile } = useMutation({
        mutationFn: async () => {
            if (!accessToken) throw new Error("Missing token");
            return await userService.updateUserDetails(accessToken, formData, setAccessToken);
        },
        onSuccess: async () => {
            await refreshUser();
            toast.success('Profile updated successfully');
            // Close edit mode and modal only on success
            setIsEditing(false);
            setShowProfileConfirm(false);
        },
        onError: (error: any) => {
            console.error('Error updating profile:', error);
            const msg = error.response?.data?.detail || 'Error updating profile';
            toast.error(msg);
            // Modal stays open
        }
    });

    // Derived state for disabling buttons
    const isSaving = isUploadingAvatar || isUpdatingProfile;

    // -------------------------------------------------------------------------
    // 2. Effects & Handlers
    // -------------------------------------------------------------------------

    useEffect(() => {
        if (user && user.details) {
            setFormData({
                username: user.details.username || '',
                profile_info: user.details.profile_info || '',
            });
        }
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image is too large. Max 5MB.');
                return;
            }
            if (!file.type.startsWith('image/')) {
                toast.error('Please select a valid image file.');
                return;
            }

            setAvatarFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setShowAvatarConfirm(true);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleUpdateProfile = () => {
        try {
            profileSchema.parse(formData);
            setErrors({});
            setShowProfileConfirm(true);
        } catch (error) {
            if (error instanceof z.ZodError) {
                const formattedErrors: { [key: string]: string } = {};
                error.issues.forEach((err) => {
                    if (err.path[0]) formattedErrors[err.path[0].toString()] = err.message;
                });
                setErrors(formattedErrors);
                toast.error('Please fix the errors in the form');
            }
        }
    };

    const cancelAvatarUpload = () => {
        setAvatarFile(null);
        setPreviewUrl(null);
        setShowAvatarConfirm(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const cancelProfileUpdate = () => {
        setShowProfileConfirm(false);
    };

    const handleEdit = () => {
        if (user?.details) {
            setFormData({
                username: user.details.username || '',
                profile_info: user.details.profile_info || '',
            });
        }
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setErrors({});
        if (user?.details) {
            setFormData({
                username: user.details.username || '',
                profile_info: user.details.profile_info || '',
            });
        }
    };

    // Helper for rendering avatar (supports preview or API url)
    // Using existing avatar_url from your type definition
    const displayAvatar = previewUrl || (user?.details?.avatar_url ? `${API_BASE_URL}${user.details.avatar_url}` : null);

    // -------------------------------------------------------------------------
    // 3. Main Render (Original UI Style preserved)
    // -------------------------------------------------------------------------
    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-8">My Profile</h1>

            <AsyncContent
                loading={isAuthLoading}
                data={user}
                // Explicitly passing null if no error, or a string if user is missing after load
                error={!user && !isAuthLoading ? "Could not load user information." : null}
            >
                <div className="bg-white shadow rounded p-6">
                    {/* Avatar Section */}
                    <div className="flex items-center mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold border border-gray-300 overflow-hidden">
                                {displayAvatar ? (
                                    <img
                                        src={displayAvatar}
                                        alt="Profile"
                                        className="w-24 h-24 rounded-full object-cover"
                                    />
                                ) : (
                                    <Avatar
                                        size={96}
                                        name={user?.details?.username || user?.email}
                                        variant="bauhaus"
                                    />
                                )}
                            </div>
                            {!isEditing && (
                                <button
                                    onClick={handleAvatarClick}
                                    disabled={isSaving}
                                    className="absolute bottom-0 left-0 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded text-xs flex items-center cursor-pointer"
                                >
                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                </button>
                            )}
                        </div>
                        <div className="ml-4 flex-1">
                            <h2 className="text-xl font-semibold">
                                {user?.details?.username || 'No username'}
                            </h2>
                            <p className="text-gray-600">{user?.email}</p>
                        </div>
                    </div>

                    {/* Profile Info Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="mt-1 text-gray-900">{user?.email}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Username</label>
                            {isEditing ? (
                                <>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        disabled={isSaving}
                                        className={`w-full px-3 py-2 border rounded text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 ${errors.username ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                    />
                                    {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
                                </>
                            ) : (
                                <p className="mt-1 text-gray-900">{user?.details?.username || 'Not set'}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Bio</label>
                            {isEditing ? (
                                <>
                                    <textarea
                                        name="profile_info"
                                        value={formData.profile_info}
                                        onChange={handleInputChange}
                                        disabled={isSaving}
                                        rows={4}
                                        maxLength={500}
                                        className={`w-full px-3 py-2 border rounded text-gray-900 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 break-words ${errors.profile_info ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="Tell us about yourself..."
                                    />
                                    {errors.profile_info && <p className="mt-1 text-sm text-red-600">{errors.profile_info}</p>}
                                </>
                            ) : (
                                <p className="mt-1 break-words text-gray-900">{user?.details?.profile_info || 'No bio set'}</p>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-6 flex justify-end space-x-3">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateProfile}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                                    disabled={isSaving}
                                >
                                    {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleEdit}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
                            >
                                Edit Profile
                            </button>
                        )}
                    </div>
                </div>
            </AsyncContent>

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={showAvatarConfirm}
                title="Confirm Avatar Update"
                message="Are you sure you want to update your profile picture?"
                // Trigger mutation instead of calling async function directly
                onConfirm={() => uploadAvatar()}
                onCancel={cancelAvatarUpload}
                confirmText="Update Avatar"
                cancelText="Cancel"
                isLoading={isUploadingAvatar}
            />

            <ConfirmationModal
                isOpen={showProfileConfirm}
                title="Confirm Profile Update"
                message="Are you sure you want to update your profile information?"
                // Trigger mutation instead of calling async function directly
                onConfirm={() => updateProfile()}
                onCancel={cancelProfileUpdate}
                confirmText="Update Profile"
                cancelText="Cancel"
                isLoading={isUpdatingProfile}
            />

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </div>
    );
};

export default ProfilePage;