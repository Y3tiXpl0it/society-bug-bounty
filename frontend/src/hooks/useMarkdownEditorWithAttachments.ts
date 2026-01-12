// frontend/src/hooks/useMarkdownEditorWithAttachments.ts
import { useState } from 'react';

interface UseMarkdownEditorWithAttachmentsReturn {
  // Estados
  files: File[];
  imagePreviews: { file: File; dataUrl: string }[];
  imageMap: Record<string, string>;
  fileError: string | null;

  // Funciones
  setFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  handleFileChange: (newFiles: File[]) => void;
  sanitizeFilename: (name: string) => string;

  // Reset
  reset: () => void;
}

export const useMarkdownEditorWithAttachments = (): UseMarkdownEditorWithAttachmentsReturn => {
  const [files, setFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<{ file: File; dataUrl: string }[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const sanitizeFilename = (name: string) => name.replace(/ /g, '_');

  const removeFile = (index: number) => {
    const fileToRemove = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileToRemove.type.startsWith('image/')) {
      setImagePreviews((prev) => prev.filter((p) => p.file !== fileToRemove));
      setImageMap((prev) => {
        const newMap = { ...prev };
        delete newMap[fileToRemove.name];
        return newMap;
      });
    }
  };

  const handleFileChange = (newFiles: File[]) => {
    const duplicates = newFiles.filter((file) => files.some((existing) => existing.name === file.name));
    const validFiles = newFiles.filter((file) => !files.some((existing) => existing.name === file.name));

    if (duplicates.length > 0) {
      const errorMessage = `Some files were not added because they have duplicate names: ${duplicates
        .map((d) => d.name)
        .join(', ')}`;
      setFileError(errorMessage);
    } else {
      setFileError(null);
    }

    // Add valid files to the state
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }

    // Process new images for preview
    const newImagePromises = validFiles
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => {
        return new Promise<{ file: File; dataUrl: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ file, dataUrl: reader.result as string });
          reader.readAsDataURL(file);
        });
      });
    Promise.all(newImagePromises).then((newPreviews) => {
      setImagePreviews((prev) => [...prev, ...newPreviews]);
      const newMap: Record<string, string> = {};
      newPreviews.forEach((p) => (newMap[sanitizeFilename(p.file.name)] = p.dataUrl));
      setImageMap((prev) => ({ ...prev, ...newMap }));
    });
  };

  const reset = () => {
    setFiles([]);
    setImagePreviews([]);
    setImageMap({});
    setFileError(null);
  };

  return {
    files,
    imagePreviews,
    imageMap,
    fileError,
    setFiles,
    removeFile,
    handleFileChange,
    sanitizeFilename,
    reset,
  };
};