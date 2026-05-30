import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../lib/session-utils';
import { setAuthToken, schoolAdminApi } from '../lib/api';

export interface CalendarEntry {
  id: string;
  school_id: string;
  date: string;
  end_date: string | null;
  name: string;
  type: 'Holiday' | 'Break' | 'HalfDay' | 'CompensatoryWork';
  academic_year: string;
  description: string | null;
  created_at: string;
}

async function authHeader() {
  const { data: { session } } = await getSession();
  if (!session) throw new Error('Not authenticated');
  setAuthToken(session.access_token || null);
}

export function useSchoolCalendar(params?: {
  year?: string;
  month?: string;
  academic_year?: string;
}) {
  return useQuery({
    queryKey: ['school-admin', 'calendar', params],
    queryFn: async () => {
      await authHeader();
      const { data } = await schoolAdminApi.calendar.list(params);
      return ((data as { calendar?: CalendarEntry[] })?.calendar ?? []) as CalendarEntry[];
    },
    retry: 1,
  });
}

export function useCreateCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      date: string;
      end_date?: string;
      name: string;
      type: string;
      academic_year?: string;
      description?: string;
    }) => {
      await authHeader();
      const { data } = await schoolAdminApi.calendar.create(body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-admin', 'calendar'] });
    },
  });
}

export function useUpdateCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; [key: string]: unknown }) => {
      await authHeader();
      const { data } = await schoolAdminApi.calendar.update(id, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-admin', 'calendar'] });
    },
  });
}

export function useDeleteCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await authHeader();
      const { data } = await schoolAdminApi.calendar.delete(id);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-admin', 'calendar'] });
    },
  });
}
