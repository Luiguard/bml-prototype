export type Role = 'EMPLOYEE' | 'SUPERVISOR' | 'HR_ADMIN' | 'SYSTEM_ADMIN';

export type TimeEntryType = 'WORK' | 'BREAK';
export type TimeEntryStatus = 'ACTIVE' | 'COMPLETED' | 'CORRECTED' | 'FLAGGED';

export type ShiftType = 'NORMAL' | 'NIGHT' | 'ONCALL' | 'STANDBY';

export type AbsenceType = 'VACATION' | 'SICK' | 'COMP_TIME' | 'SPECIAL_LEAVE' | 'OTHER';
export type AbsenceStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';

export type DocumentType = 'CONTRACT' | 'PAYSLIP' | 'SCHEDULE' | 'INSTRUCTION' | 'CERTIFICATE' | 'OTHER';

export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL';

export interface DashboardData {
  today: {
    shiftStart: string | null;
    shiftEnd: string | null;
    workedMinutes: number;
    breakMinutes: number;
    isCheckedIn: boolean;
  };
  week: {
    totalHours: number;
    overtimeHours: number;
    absenceDays: number;
  };
  month: {
    totalHours: number;
    overtimeHours: number;
    absenceDays: number;
  };
  nextShift: {
    date: string;
    startTime: string;
    endTime: string;
    location: string | null;
    type: ShiftType;
  } | null;
  nextTrip: {
    destination: string;
    startDate: string;
    endDate: string;
  } | null;
  unreadNotifications: number;
  unreadDocuments: number;
}

export interface TimeEntrySummary {
  date: string;
  entries: {
    id: string;
    type: TimeEntryType;
    start: string;
    end: string | null;
    duration: number | null;
    status: TimeEntryStatus;
    project: string | null;
  }[];
  totalMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
}

export interface UserSession {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  modules: string[];
  locale: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}
