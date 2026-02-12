export enum UserRole {
  ADMIN = 'ADMIN', // Super Admin (Owner)
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  DOCTOR = 'DOCTOR',
  RECEPTIONIST = 'RECEPTIONIST',
  NURSE = 'NURSE',
  PHARMACY_MANAGER = 'PHARMACY_MANAGER'
}

export enum Department {
  ORTHOPEDICS = 'Orthopedics',
  CARDIOLOGY = 'Cardiology',
  DENTISTRY = 'Dentistry',
  INTERNAL_MEDICINE = 'Internal Medicine',
  PEDIATRICS = 'Pediatrics',
  DERMATOLOGY = 'Dermatology'
}

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  WAITING = 'WAITING', // Checked in
  CALLED = 'CALLED',   // Called to room
  IN_PROGRESS = 'IN_PROGRESS', // With doctor
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  managerId?: string;
  contactPhone: string;
  isActive: boolean;
}

export interface WeeklyShift {
  id: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, etc.
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  branchId: string;
  slotDuration: number; // minutes
}

export interface PayrollConfig {
  model: 'FIXED_SALARY' | 'PERCENTAGE' | 'HYBRID';
  baseSalary: number;
  commissionPercentage?: number; // 0-100
  effectiveDate: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  specialty?: Department; // For doctors
  assignedBranches: string[]; // Branch IDs
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  
  // Specific to Doctors/Staff
  consultationFee?: number; 
  schedule?: WeeklyShift[];
  payroll?: PayrollConfig;
  joinDate?: string;
}

export interface Employee extends User {
  jobTitle: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female';
  phone: string;
  lastVisit: string;
  medicalHistorySummary: string;
  allergies?: string[];
  chronicConditions?: string[];
  balance: number; // Outstanding payments
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

// --- Billing Types ---

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  INSURANCE = 'INSURANCE',
  TRANSFER = 'TRANSFER'
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  category: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'SUPPLY';
  department?: Department;
}

export interface InvoiceItem {
  id: string;
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  addedBy: string; // User ID
  timestamp: string;
}

export interface Transaction {
  id: string;
  amount: number;
  method: PaymentMethod;
  timestamp: string;
  recordedBy: string;
  reference?: string; // Receipt #
  type: 'PAYMENT' | 'REFUND';
}

export interface BillingDetails {
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: PaymentStatus;
  transactions: Transaction[];
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  branchId: string;
  date: string; // ISO Date
  timeSlot: string;
  department: Department;
  status: AppointmentStatus;
  notes?: string;
  type: 'Consultation' | 'Follow-up' | 'Procedure';
  billing: BillingDetails; // Financial State
  createdAt: string;
}

export interface QueueItem extends Appointment {
  arrivalTime?: string;
  estimatedWaitTime?: number; // Minutes
}

// --- Medical Records ---

export interface VitalSigns {
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  oxygenSat?: number;
  recordedBy: string; // User ID (Nurse)
  timestamp: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface MedicalEncounter {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  date: string;
  vitals?: VitalSigns;
  symptoms: string;
  diagnosis: string;
  prescription: Medication[];
  labOrders?: string[];
  internalNotes: string; // Private to staff
  status: 'DRAFT' | 'FINALIZED';
}

// --- Admin Stats ---

export interface ClinicStats {
  totalRevenue: number;
  appointmentsCount: number;
  patientsCount: number;
  revenueByBranch: Record<string, number>;
  topDoctors: { id: string; name: string; revenue: number }[];
}