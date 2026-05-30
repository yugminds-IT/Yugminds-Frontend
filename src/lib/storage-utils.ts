/**
 * Storage Utilities for Course File Management
 * Uses backend API (replaces Supabase).
 */

import { backendRequest } from './backend-client';
import { logger } from './logger';

export interface CourseStoragePaths {
  thumbnailPaths: string[];
  chapterContentPaths: string[];
  materialPaths: string[];
  videoPaths: string[];
  allPaths: string[];
}

export async function collectCourseStoragePaths(courseId: string): Promise<CourseStoragePaths> {
  const paths: CourseStoragePaths = {
    thumbnailPaths: [],
    chapterContentPaths: [],
    materialPaths: [],
    videoPaths: [],
    allPaths: [],
  };

  try {
    const data = await backendRequest<{
      thumbnailPaths?: string[];
      chapterContentPaths?: string[];
      materialPaths?: string[];
      videoPaths?: string[];
    }>(`courses/${courseId}/storage-paths`).catch(() => null);

    if (data) {
      paths.thumbnailPaths = data.thumbnailPaths ?? [];
      paths.chapterContentPaths = data.chapterContentPaths ?? [];
      paths.materialPaths = data.materialPaths ?? [];
      paths.videoPaths = data.videoPaths ?? [];
    }

    paths.allPaths = [...new Set([
      ...paths.thumbnailPaths,
      ...paths.chapterContentPaths,
      ...paths.materialPaths,
      ...paths.videoPaths,
    ])];

    return paths;
  } catch (error) {
    logger.warn('Error collecting course storage paths (backend may not have endpoint yet)', { courseId });
    return paths;
  }
}

export async function deleteStorageFiles(
  bucketName: string,
  paths: string[]
): Promise<{ successCount: number; failedPaths: string[] }> {
  if (paths.length === 0) return { successCount: 0, failedPaths: [] };

  try {
    const result = await backendRequest<{ successCount?: number; failedPaths?: string[] }>('storage/delete', {
      method: 'POST',
      body: JSON.stringify({ bucketName, paths }),
    });
    return {
      successCount: result?.successCount ?? paths.length,
      failedPaths: result?.failedPaths ?? [],
    };
  } catch (error) {
    logger.error('Error deleting storage files', { bucketName, pathCount: paths.length });
    return { successCount: 0, failedPaths: paths };
  }
}

export async function cleanupCourseStorage(
  courseId: string,
  bucketName: string = 'course-files'
): Promise<{ success: boolean; deletedCount: number; failedPaths: string[] }> {
  try {
    const storagePaths = await collectCourseStoragePaths(courseId);
    if (storagePaths.allPaths.length === 0) {
      return { success: true, deletedCount: 0, failedPaths: [] };
    }
    const result = await deleteStorageFiles(bucketName, storagePaths.allPaths);
    return {
      success: result.failedPaths.length === 0,
      deletedCount: result.successCount,
      failedPaths: result.failedPaths,
    };
  } catch (error) {
    logger.error('Exception during course storage cleanup', { courseId, bucketName });
    return { success: false, deletedCount: 0, failedPaths: [] };
  }
}
