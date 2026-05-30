export const queryKeys = {
  shared: {
    unreadNotificationCount: ['unreadNotificationCount'] as const,
  },
  admin: {
    dashboardStats: ['admin', 'dashboard', 'stats'] as const,
    recentActivity: ['admin', 'dashboard', 'activity'] as const,
    quickPreviews: ['admin', 'dashboard', 'previews'] as const,
    notifications: ['admin', 'notifications'] as const,
    studentProgress: ['admin', 'student-progress'] as const,
    schools: ['admin', 'schools'] as const,
  },
  schoolAdmin: {
    school: ['school-admin', 'school'] as const,
    profile: ['school-admin', 'profile'] as const,
    dashboardStats: ['school-admin', 'dashboard', 'stats'] as const,
    recentActivity: ['school-admin', 'dashboard', 'activity'] as const,
    quickPreviews: ['school-admin', 'dashboard', 'previews'] as const,
    notifications: ['school-admin', 'notifications'] as const,
    studentProgress: ['school-admin', 'student-progress'] as const,
  },
  teacher: {
    dashboard: ['teacher', 'dashboard'] as const,
    studentProgress: ['teacher', 'student-progress'] as const,
    notifications: ['teacher', 'notifications'] as const,
    classes: ['teacher', 'classes'] as const,
    schedules: ['teacher', 'schedules'] as const,
    reports: ['teacher', 'reports'] as const,
    attendance: ['teacher', 'attendance'] as const,
    leaves: ['teacher', 'leaves'] as const,
  },
  student: {
    dashboardStats: ['studentDashboardStats'] as const,
    notifications: ['studentNotifications'] as const,
    courses: ['studentCourses'] as const,
    assignments: ['studentAssignments'] as const,
  },
} as const;

export type QueryKeyLike = readonly unknown[];
