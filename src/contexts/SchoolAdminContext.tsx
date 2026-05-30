"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { schoolAdminApi } from '../lib/api/school-admin.api';

interface SchoolInfo {
  id: string;
  name?: string | null;
  [key: string]: unknown;
}

interface SchoolAdminContextType {
  schoolInfo: SchoolInfo | null;
  profileFullName: string | null;
  loading: boolean;
  refreshSchoolInfo: () => Promise<void>;
}

const SchoolAdminContext = createContext<SchoolAdminContextType | undefined>(undefined);

export function SchoolAdminProvider({
  children,
  initialSchoolInfo = null,
  initialProfileFullName = null,
}: {
  children: React.ReactNode;
  initialSchoolInfo?: SchoolInfo | null;
  initialProfileFullName?: string | null;
}) {
  // Seeded by the layout with data it already fetched — no extra API calls needed on mount.
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(initialSchoolInfo);
  const [profileFullName] = useState<string | null>(initialProfileFullName);
  const [loading, setLoading] = useState(false);

  // Only used for explicit refresh actions (e.g. after editing school details).
  const refreshSchoolInfo = useCallback(async () => {
    try {
      setLoading(true);
      const schoolRes = await schoolAdminApi.school.get();
      const schoolData = schoolRes.data ?? {};
      const school = (schoolData as { school?: unknown }).school ?? null;
      if (school) {
        setSchoolInfo(school as SchoolInfo);
      }
    } catch (error) {
      console.error('Error refreshing school info:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SchoolAdminContext.Provider value={{ schoolInfo, profileFullName, loading, refreshSchoolInfo }}>
      {children}
    </SchoolAdminContext.Provider>
  );
}

export function useSchoolAdmin() {
  const context = useContext(SchoolAdminContext);
  if (context === undefined) {
    throw new Error('useSchoolAdmin must be used within a SchoolAdminProvider');
  }
  return context;
}

