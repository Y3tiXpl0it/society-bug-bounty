import React, { useState, useRef } from 'react';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import userService from '../services/userService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const profileSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters long')
        .max(24, 'Username must be no more than 24 characters long')
        .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, underscores, hyphens, and dots')
        .refine(val => !['admin', 'root', 'administrator', 'support', 'info'].includes(val.toLowerCase()), 'This username is reserved and cannot be used'),
    profile_info: z.string().max(500, 'Profile info must be at most 500 characters long'),
});

const ProfilePage: React.FC = () => {
    const { user, accessToken, setAccessToken, isLoading: isAuthLoading, refreshUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    
    // Initialize form state with current user details
    const [formData, setFormData] = useState({
        username: user?.details?.username || '',
        profile_info: user?.details?.profile_info || '',
    });
    
    const [errors, setErrors] = useState<{ username?: string; profile_info?: string }>({});
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    
    // Confirmation modal states
    const [showAvatarConfirm, setShowAvatarConfirm] = useState(false);
    const [showProfileConfirm, setShowProfileConfirm] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // -------------------------------------------------------------------------
    // 1. Hook to handle Profile Updates
    // -------------------------------------------------------------------------
    const { execute: updateProfile, loading: isUpdatingProfile } = useAsync(
        async () => {
            return await userService.updateUserDetails(accessToken, formData, setAccessToken);
        },
        {
            onSuccess: async () => {
                toast.success('Profile updated successfully!');
                await refreshUser(); // Refresh global auth context
                setIsEditing(false);
                setErrors({});
                setShowProfileConfirm(false);
            },
            onError: (message) => {
                setShowProfileConfirm(false);
                // Map specific backend errors to form fields
                if (message.toLowerCase().includes('username already exists')) {
                    setErrors(prev => ({ ...prev, username: 'Username already exists' }));
                }
            }
        }
    );

    // -------------------------------------------------------------------------
    // 2. Hook to handle Avatar Uploads
    // -------------------------------------------------------------------------
    const { execute: uploadAvatar, loading: isUploadingAvatar } = useAsync(
        async () => {
            if (!selectedFile) throw new Error("No file selected");
            return await userService.uploadAvatar(accessToken, selectedFile, setAccessToken);
        },
        {
            onSuccess: async () => {
                toast.success('Avatar updated successfully!');
                await refreshUser(); // Refresh global auth context to show new image
                setShowAvatarConfirm(false);
                setSelectedFile(null);
            },
            onError: () => {
                setShowAvatarConfirm(false);
            }
        }
    );

    // Derive loading state for UI blocking
    const isSaving = isUpdatingProfile || isUploadingAvatar;

    // --- Event Handlers ---

    if (isAuthLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-8">
                <p>Please log in to view your profile.</p>
            </div>
        );
    }

    const handleEdit = () => {
        setFormData({
            username: user.details?.username || '',
            profile_info: user.details?.profile_info || '',
        });
        setSelectedFile(null);
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setErrors({});
    };

    const handleEditAvatar = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setShowAvatarConfirm(true);
        }
    };

    const confirmAvatarUpload = async () => {
        await uploadAvatar();
    };

    const cancelAvatarUpload = () => {
        setShowAvatarConfirm(false);
        setSelectedFile(null);
        // Reset file input to allow selecting the same file again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = () => {
        // Validate with Zod before showing confirmation modal
        const result = profileSchema.safeParse(formData);
        if (!result.success) {
            const fieldErrors: { username?: string; profile_info?: string } = {};
            result.error.issues.forEach(issue => {
                if (issue.path[0] === 'username') fieldErrors.username = issue.message;
                if (issue.path[0] === 'profile_info') fieldErrors.profile_info = issue.message;
            });
            setErrors(fieldErrors);
            return;
        }
        setShowProfileConfirm(true);
    };

    const confirmProfileUpdate = async () => {
        await updateProfile();
    };

    const cancelProfileUpdate = () => {
        setShowProfileConfirm(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));

        // Real-time validation
        const tempData = { ...formData, [name]: value };
        const result = profileSchema.safeParse(tempData);
        
        const fieldErrors: { username?: string; profile_info?: string } = { ...errors };
        if (name === 'username') delete fieldErrors.username;
        if (name === 'profile_info') delete fieldErrors.profile_info;

        if (!result.success) {
            result.error.issues.forEach(issue => {
                if (issue.path[0] === name) {
                    // @ts-ignore
                    fieldErrors[name] = issue.message;
                }
            });
        }
        setErrors(fieldErrors);
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-8">My Profile</h1>

            <div className="bg-white shadow rounded p-6">
                {/* Avatar Section */}
                <div className="flex items-center mb-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-semibold border border-gray-300">
                            {user.details?.avatar_url ? (
                                <img
                                    src={`${API_BASE_URL}${user.details.avatar_url}`}
                                    alt="Avatar"
                                    className="w-24 h-24 rounded-full object-cover"
                                />
                            ) : (
                                user.details?.username?.charAt(0).toUpperCase() || 'U'
                            )}
                        </div>
                        {!isEditing && (
                            <button
                                onClick={handleEditAvatar}
                                disabled={isSaving}
                                className="absolute bottom-0 left-0 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-color-primary border border-gray-300 rounded text-xs flex items-center cursor-pointer"
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
                            {user.details?.username || 'No username'}
                        </h2>
                        <p>{user.email}</p>
                    </div>
                </div>

                {/* Profile Info Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-color-primary">Email</label>
                        <p className="mt-1">{user.email}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-color-primary">Username</label>
                        {isEditing ? (
                            <>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    disabled={isSaving}
                                    className={`w-full px-3 py-2 border rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 ${
                                        errors.username ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                />
                                {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
                            </>
                        ) : (
                            <p className="mt-1">{user.details?.username || 'Not set'}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-color-primary">Bio</label>
                        {isEditing ? (
                            <>
                                <textarea
                                    name="profile_info"
                                    value={formData.profile_info}
                                    onChange={handleInputChange}
                                    disabled={isSaving}
                                    rows={4}
                                    maxLength={500}
                                    className={`w-full px-3 py-2 border rounded text-color-primary focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 break-words ${
                                        errors.profile_info ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                    placeholder="Tell us about yourself..."
                                />
                                {errors.profile_info && <p className="mt-1 text-sm text-red-600">{errors.profile_info}</p>}
                            </>
                        ) : (
                            <p className="mt-1 break-words">{user.details?.profile_info || 'No bio set'}</p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-end space-x-3">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 border border-gray-300 rounded-md text-color-primary hover:bg-gray-50"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
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

            <ConfirmationModal
                isOpen={showAvatarConfirm}
                title="Confirm Avatar Update"
                message="Are you sure you want to update your profile picture?"
                onConfirm={confirmAvatarUpload}
                onCancel={cancelAvatarUpload}
                confirmText="Update Avatar"
                cancelText="Cancel"
                isLoading={isUploadingAvatar}
            />

            <ConfirmationModal
                isOpen={showProfileConfirm}
                title="Confirm Profile Update"
                message="Are you sure you want to update your profile information?"
                onConfirm={confirmProfileUpdate}
                onCancel={cancelProfileUpdate}
                confirmText="Update Profile"
                cancelText="Cancel"
                isLoading={isUpdatingProfile}
            />

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