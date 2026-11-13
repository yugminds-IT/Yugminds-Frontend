/** Shapes the school-admin timetable pages work with. */

export interface Schedule {
  id: string;
  school_id: string;
  class_id?: string;
  teacher_id?: string;
  subject: string;
  grade: string;
  section?: string | null;
  day_of_week: string;
  period_id?: string;
  room_id?: string;
  start_time: string;
  end_time: string;
  academic_year: string;
  is_active: boolean;
  notes?: string;
  class?: {
    id: string;
    class_name: string;
    grade: string;
    subject: string;
  };
  teacher?: {
    id: string;
    full_name: string;
    email: string;
  };
  period?: {
    id: string;
    period_number: number;
    start_time: string;
    end_time: string;
  };
  room?: {
    id: string;
    room_number: string;
    room_name?: string;
    capacity?: number;
  };
}

export interface Period {
  id: string;
  school_id: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface Room {
  id: string;
  school_id: string;
  room_number: string;
  room_name?: string;
  room_type?: string;
  capacity?: number;
  location?: string;
  facilities?: string[];
  is_active: boolean;
}

export interface Teacher {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  subjects: string[];
  grades_assigned: string[];
  grade_sections_assigned?: Array<{ grade: string; sections: string[] }>;
  teacher_schools?: Array<{
    grades_assigned: string[];
    subjects: string[];
    working_days_per_week: number;
    /** Which weekdays this teacher works at this school — 0=Sun..6=Sat. */
    working_days?: number[];
    /** Half-day windows per weekday (0=Sun..6=Sat); a day not listed is a full day. */
    day_slots?: Record<string, { slot: 'MORNING' | 'AFTERNOON'; start: string; end: string }> | null;
    /** Calendar date range the teacher is assigned to this school (YYYY-MM-DD); null = no bound. */
    assigned_from?: string | null;
    assigned_until?: string | null;
    max_students_per_session: number;
    grade_sections_assigned?: Array<{ grade: string; sections: string[] }>;
    sections_assigned?: string[];
  }>;
}

export interface Class {
  id: string;
  class_name: string;
  grade: string;
  subject?: string;
}

export type ScheduleForm = {
  class_id: string;
  teacher_id: string;
  subject: string;
  grade: string;
  section: string;
  day_of_week: string;
  period_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  academic_year: string;
  notes: string;
};

export type PeriodForm = {
  period_number: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type RoomForm = {
  room_number: string;
  room_name: string;
  room_type: string;
  capacity: string;
  location: string;
  facilities: string[];
  is_active: boolean;
};
