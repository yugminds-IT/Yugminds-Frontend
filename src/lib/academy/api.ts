/**
 * Academy API — the standalone B2C app (own accounts, courses, payments).
 * Nothing here talks to the LMS except the admin-only one-way LMS import.
 */
import { http, qs } from "./client";

export type Role = "LEARNER" | "TUTOR" | "ADMIN";
export type LessonType = "VIDEO" | "PDF" | "TEXT" | "QUIZ" | "LINK";
export type ProductType = "COURSE" | "SESSION_PACK";
export type OrderStatus = "CREATED" | "PAID" | "FAILED" | "REFUNDED";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface Account {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  mustChangePassword: boolean;
}

export interface Product {
  id: string;
  type: ProductType;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  priceInPaise: number;
  mrpInPaise: number | null;
  courseId: string | null;
  sessionMinutes: number | null;
  sessionCount: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ProductDetail extends Product {
  curriculum: {
    id: string;
    title: string;
    lessons: { title: string; type: LessonType; durationMinutes: number | null; isPreview: boolean }[];
  }[];
}

export interface Tutor {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  subjects: string[];
  photoUrl: string | null;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Booking {
  id: string;
  tutorId: string;
  learnerId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  meetingLink: string | null;
  tutorNotes?: string | null;
  tutorName?: string;
  learner?: { fullName: string; phone: string | null; parentName: string | null } | null;
}

export interface Credit {
  id: string;
  total: number;
  used: number;
  remaining: number;
  minutes: number;
}

export interface CheckoutSession {
  orderId: string;
  razorpayOrderId: string;
  keyId: string;
  amountInPaise: number;
  currency: string;
  productTitle: string;
  prefill: { name: string; email: string; contact: string };
}

/** ₹0 products are granted straight away (no payment window). */
export interface FreeClaim {
  free: true;
  product: { type: ProductType; courseId: string | null };
}

export interface Order {
  id: string;
  receiptNo: string;
  amountInPaise: number;
  status: OrderStatus;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt?: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  product: { title: string; type: ProductType };
}

export interface MyCourse {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  completedAt: string | null;
}

export interface PlayerLesson {
  id: string;
  title: string;
  type: LessonType;
  durationMinutes: number | null;
  isPreview: boolean;
  locked: boolean;
  completed: boolean;
  quizScore: number | null;
  contentUrl?: string | null;
  body?: string | null;
  quiz?: { question: string; options: string[] }[] | null;
}

export interface PlayerCourse {
  id: string;
  title: string;
  description: string | null;
  enrolled: boolean;
  completedAt: string | null;
  modules: { id: string; title: string; lessons: PlayerLesson[] }[];
}

export interface ProgressResult {
  courseCompleted: boolean;
  certificateId: string | null;
}

export interface Certificate {
  shortId: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
}

export interface TutorProfile {
  id: string;
  accountId: string;
  headline: string | null;
  bio: string | null;
  subjects: string[];
  photoUrl: string | null;
  defaultMeetingLink: string | null;
  isActive: boolean;
  availability: AvailabilityWindow[];
}

export interface TutorAdminRow extends TutorProfile {
  account: { id: string; email: string; fullName: string; phone: string | null; isActive: boolean } | null;
}

export interface LearnerRow {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  parentName: string | null;
  isActive: boolean;
  createdAt: string;
  courseCount: number;
  spentInPaise: number;
}

export interface Overview {
  revenueInPaise: number;
  paidOrders: number;
  monthRevenueInPaise: number;
  monthOrders: number;
  learners: number;
  daily: { date: string; amountInPaise: number; orders: number; signups: number }[];
  attention: { draftCourses: number; classesWithoutLink: number };
  upcomingBookings: { id: string; startsAt: string; meetingLink: string | null; learnerName: string; tutorName: string }[];
  recentOrders: { id: string; buyerName: string | null; amountInPaise: number; paidAt: string | null; product: { title: string } }[];
}

export interface BuilderLesson {
  id: string;
  moduleId: string;
  title: string;
  type: LessonType;
  contentUrl: string | null;
  body: string | null;
  quiz: { question: string; options: string[]; answer: number }[] | null;
  durationMinutes: number | null;
  isPreview: boolean;
  sortOrder: number;
}

export interface BuilderCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  importedFromLmsCourseId: string | null;
  modules: { id: string; title: string; sortOrder: number; lessons: BuilderLesson[] }[];
}

export interface CourseRow {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  isPublished: boolean;
  updatedAt: string;
  importedFromLmsCourseId: string | null;
  moduleCount: number;
  lessonCount: number;
  learnerCount: number;
}

export type LessonInput = Omit<BuilderLesson, "id" | "moduleId" | "sortOrder">;
export type ProductInput = Omit<Product, "id">;

export const academy = {
  auth: {
    me: () => http.get<Account>("/auth/me"),
    login: (email: string, password: string) => http.post<Account>("/auth/login", { email, password }),
    signup: (data: { fullName: string; email: string; password: string; phone: string; parentName?: string }) =>
      http.post<Account>("/auth/signup", data),
    logout: () => http.post<{ ok: boolean }>("/auth/logout"),
    updateMe: (data: { fullName?: string; phone?: string; parentName?: string }) => http.patch<Account>("/auth/me", data),
    changePassword: (currentPassword: string, newPassword: string) =>
      http.post<{ ok: boolean }>("/auth/change-password", { currentPassword, newPassword }),
  },

  catalog: {
    products: () => http.get<Product[]>("/products"),
    product: (slug: string) => http.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
    tutors: () => http.get<Tutor[]>("/tutors"),
    slots: (id: string, minutes: number) => http.get<string[]>(`/tutors/${id}/slots${qs({ minutes })}`),
    certificate: (shortId: string) => http.get<Certificate>(`/certificates/${encodeURIComponent(shortId)}`),
  },

  me: {
    courses: () => http.get<MyCourse[]>("/me/courses"),
    course: (id: string) => http.get<PlayerCourse>(`/me/courses/${id}`),
    complete: (lessonId: string) => http.post<ProgressResult>(`/me/lessons/${lessonId}/complete`),
    quiz: (lessonId: string, answers: number[]) =>
      http.post<ProgressResult & { score: number; passed: boolean; correct: boolean[] }>(`/me/lessons/${lessonId}/quiz`, { answers }),
    certificates: () => http.get<Certificate[]>("/me/certificates"),
    checkout: (productId: string) => http.post<CheckoutSession | FreeClaim>("/me/checkout", { productId }),
    verify: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
      http.post<{ id: string; status: OrderStatus; receiptNo: string; product: { type: ProductType; courseId: string | null; title: string } }>(
        "/me/checkout/verify",
        data,
      ),
    orders: () => http.get<Order[]>("/me/orders"),
    credits: () => http.get<Credit[]>("/me/credits"),
    bookings: () => http.get<Booking[]>("/me/bookings"),
    book: (tutorId: string, startsAt: string) => http.post<Booking>("/me/bookings", { tutorId, startsAt }),
    cancel: (id: string) => http.post<{ ok: boolean; creditReturned: boolean }>(`/me/bookings/${id}/cancel`),
  },

  tutor: {
    me: () => http.get<TutorProfile>("/tutor/me"),
    updateMe: (data: Partial<Pick<TutorProfile, "headline" | "bio" | "subjects" | "photoUrl" | "defaultMeetingLink">>) =>
      http.patch<TutorProfile>("/tutor/me", data),
    setAvailability: (windows: AvailabilityWindow[]) => http.put<AvailabilityWindow[]>("/tutor/availability", { windows }),
    bookings: (scope: "upcoming" | "past" | "all" = "upcoming") => http.get<Booking[]>(`/tutor/bookings${qs({ scope })}`),
    updateBooking: (id: string, data: { meetingLink?: string; tutorNotes?: string; status?: BookingStatus }) =>
      http.patch<Booking>(`/tutor/bookings/${id}`, data),
    cancel: (id: string) => http.post<{ ok: boolean }>(`/tutor/bookings/${id}/cancel`),
  },

  admin: {
    overview: () => http.get<Overview>("/admin/overview"),
    courses: () => http.get<CourseRow[]>("/admin/courses"),
    course: (id: string) => http.get<BuilderCourse>(`/admin/courses/${id}`),
    createCourse: (data: { title: string; description?: string }) => http.post<{ id: string }>("/admin/courses", data),
    updateCourse: (id: string, data: { title: string; description?: string; thumbnailUrl?: string; isPublished?: boolean }) =>
      http.patch<BuilderCourse>(`/admin/courses/${id}`, data),
    deleteCourse: (id: string) => http.del<{ ok: boolean }>(`/admin/courses/${id}`),
    addModule: (courseId: string, title: string) => http.post<{ id: string }>(`/admin/courses/${courseId}/modules`, { title }),
    updateModule: (id: string, title: string) => http.patch(`/admin/modules/${id}`, { title }),
    deleteModule: (id: string) => http.del(`/admin/modules/${id}`),
    moveModule: (id: string, direction: "up" | "down") => http.post(`/admin/modules/${id}/move`, { direction }),
    addLesson: (moduleId: string, data: LessonInput) => http.post(`/admin/modules/${moduleId}/lessons`, data),
    updateLesson: (id: string, data: LessonInput) => http.patch(`/admin/lessons/${id}`, data),
    deleteLesson: (id: string) => http.del(`/admin/lessons/${id}`),
    moveLesson: (id: string, direction: "up" | "down") => http.post(`/admin/lessons/${id}/move`, { direction }),
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return http.upload<{ url: string }>("/admin/uploads", form);
    },
    lmsCourses: () =>
      http.get<{ id: string; title: string; isPublished: boolean; _count: { chapters: number } }[]>("/admin/lms-courses"),
    importLms: (id: string) => http.post<{ id: string; title: string }>(`/admin/lms-courses/${id}/import`),
    products: () => http.get<Product[]>("/admin/products"),
    createProduct: (data: ProductInput) => http.post<Product>("/admin/products", data),
    updateProduct: (id: string, data: ProductInput) => http.patch<Product>(`/admin/products/${id}`, data),
    orders: (params: { status?: string; search?: string; take?: number; skip?: number }) =>
      http.get<{ rows: (Order & { createdAt: string })[]; total: number }>(`/admin/orders${qs(params)}`),
    refund: (id: string) => http.post(`/admin/orders/${id}/refund`),
    learners: (search?: string) => http.get<LearnerRow[]>(`/admin/learners${qs({ search })}`),
    grant: (learnerId: string, courseId: string) => http.post("/admin/learners/grant", { learnerId, courseId }),
    resetPassword: (accountId: string) =>
      http.post<{ email: string; tempPassword: string }>(`/admin/accounts/${accountId}/reset-password`),
    setActive: (accountId: string, isActive: boolean) => http.post(`/admin/accounts/${accountId}/active`, { isActive }),
    tutors: () => http.get<TutorAdminRow[]>("/admin/tutors"),
    createTutor: (data: { fullName: string; email: string; phone?: string; headline?: string; subjects?: string[] }) =>
      http.post<{ accountId: string; email: string; tempPassword: string }>("/admin/tutors", data),
    updateTutor: (id: string, data: Partial<Pick<TutorProfile, "headline" | "bio" | "subjects" | "photoUrl" | "defaultMeetingLink" | "isActive">>) =>
      http.patch(`/admin/tutors/${id}`, data),
    bookings: () => http.get<(Booking & { tutorName: string })[]>("/admin/bookings"),
    cancelBooking: (id: string) => http.post(`/admin/bookings/${id}/cancel`),
  },
};

/** ₹ formatting for paise amounts. */
export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}
