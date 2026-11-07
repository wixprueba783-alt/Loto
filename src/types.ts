export type Role = 'guest' | 'client' | 'admin' | 'branchAdmin' | 'worker';

export type Page =
  | 'home' | 'catalog' | 'booking' | 'login' | 'register'
  | 'my-appointments' | 'client-payments' | 'profile'
  | 'worker-today'
  | 'gallery'
  | 'admin-dashboard' | 'admin-appointments' | 'admin-calendar'
  | 'admin-availability' | 'admin-catalog' | 'admin-specialized' | 'admin-gallery'
  | 'admin-payments' | 'admin-stats' | 'admin-settings' | 'privacy';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PaymentMethod = 'transfer' | 'cash' | 'card';
export type BranchId = 'main' | 'north';

export interface User {
  uid?: string;
  name: string;
  email: string;
  phone: string;
  role?: Exclude<Role, 'guest'>;
  branchId?: BranchId;
  avatar?: string;
  privacyConsent?: PrivacyConsent;
  marketingConsent?: { accepted: boolean; acceptedAt?: string };
}

export interface PrivacyConsent {
  accepted: boolean;
  version: string;
  acceptedAt: string;
  source: 'registration' | 'google' | 'booking';
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  image: string;
  category: string;
  active: boolean;
  featured?: boolean;
  showPrice?: boolean;
}

export interface ServiceSubservice {
  id: string;
  name: string;
  description?: string;
  pricePerNail: number;
  image: string;
  active: boolean;
  createdAt?: string;
  showPrice?: boolean;
}

export interface BusinessSettings {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  latitude?: string;
  longitude?: string;
  categories?: string[];
  autoConfirm: boolean;
  reminderEmail: boolean;
  reminderHours: string;
  maxDailyAppts: string;
  appointmentDuration: string;
  publicHours?: PublicBusinessHours;
  homepageHeroImage?: string;
  homepageAboutImage?: string;
  secondaryBranch?: BranchBusinessSettings;
  branchColors?: Record<BranchId, string>;
  privacyResponsibleName?: string;
  privacyAddress?: string;
  privacyEmail?: string;
  privacyPhone?: string;
  privacyRetention?: string;
  privacyPolicyText?: string;
  privacyPolicyVersion?: string;
  whatsappAutomations?: WhatsAppAutomationSettings;
}

export interface PublicBusinessHours {
  weekdays: { open: string; close: string };
  saturday: { open: string; close: string };
  sunday: string;
}

export type WhatsAppAutomationKey =
  | 'received'
  | 'confirmed'
  | 'reminder';

export interface WhatsAppAutomationSettings {
  enabled?: Partial<Record<WhatsAppAutomationKey, boolean>>;
  templates?: Partial<Record<WhatsAppAutomationKey, string>>;
  templateVersion?: number;
  reminderHours?: number;
}

export interface BranchBusinessSettings {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  latitude?: string;
  longitude?: string;
}

export interface Appointment {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  service: Service;
  date: string;
  time: string;
  status: AppointmentStatus;
  payments: { method: PaymentMethod; amount: number }[];
  total: number;
  services?: Service[];
  duration?: number;
  serviceType?: 'manicure' | 'pedicure';
  subservices?: { id: string; name: string; pricePerNail: number; quantity: number; showPrice?: boolean }[];
  notes?: string;
  createdAt: string;
  paymentProof?: string;
  ownerUid?: string;
  workerUid?: string;
  ticketFolio?: string;
  branchId?: BranchId;
  privacyConsent?: PrivacyConsent;
  marketingConsent?: { accepted: boolean; acceptedAt?: string };
}

export interface BlockedDay {
  date: string;
  reason: string;
  branchId?: BranchId;
}

export interface BlockedTime {
  date: string;
  time: string;
  reason: string;
  branchId?: BranchId;
}

export interface GalleryPhoto {
  id: string;
  url: string;
  serviceId?: string;
  alt: string;
  order: number;
}

export interface AppState {
  role: Role;
  page: Page;
  user: User | null;
  sidebarOpen: boolean;
  bookingService?: Service;
  notification?: { message: string; type: 'success' | 'error' | 'info' } | null;
}
