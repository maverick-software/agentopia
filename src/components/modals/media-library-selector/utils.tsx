import React from 'react';
import { BookMarked, BookOpen, FileText, GraduationCap, Image, Music, Shield, Video } from 'lucide-react';
import { MediaCategory, MediaFile } from './types';

export const filterMediaFiles = (files: MediaFile[], searchQuery: string, selectedCategory: string): MediaFile[] => {
  const normalizedSearch = searchQuery.toLowerCase();

  return files.filter((file) => {
    const matchesSearch =
      searchQuery === '' ||
      file.file_name.toLowerCase().includes(normalizedSearch) ||
      file.display_name.toLowerCase().includes(normalizedSearch) ||
      file.description?.toLowerCase().includes(normalizedSearch) ||
      file.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

    const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
};

export const getFileTypeIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
  if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
};

export const getCategoryIcon = (iconName?: MediaCategory['icon_name']) => {
  switch (iconName) {
    case 'BookOpen':
      return <BookOpen className="h-4 w-4" />;
    case 'GraduationCap':
      return <GraduationCap className="h-4 w-4" />;
    case 'BookMarked':
      return <BookMarked className="h-4 w-4" />;
    case 'Shield':
      return <Shield className="h-4 w-4" />;
    case 'FileTemplate':
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
