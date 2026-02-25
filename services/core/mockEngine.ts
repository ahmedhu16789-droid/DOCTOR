import { Appointment, Branch, Patient, User, UserRole, PaymentStatus, Department } from '../../types';
import { CashSessionData } from '../api';
import { MOCK_APPOINTMENTS, MOCK_EMPLOYEES, MOCK_PATIENTS, MOCK_SCHEDULES, generateTimeSlots } from '../mockData';

// Expand mock memory
let memoryAppointments = [...MOCK_APPOINTMENTS];
let memoryPatients = [...MOCK_PATIENTS];

const MOCK_USERS: User[] = [
    {
        id: 'admin1',
        name: 'Super Admin',
        email: 'admin@clinic.com',
        role: UserRole.ADMIN,
        assignedBranches: ['b1', 'b2'],
    },
    {
        id: 'u1',
        name: 'Dr. Sarah Ahmed',
        email: 'sarah@clinic.com',
        role: UserRole.DOCTOR,
        assignedBranches: ['b1', 'b2'],
        schedule: MOCK_SCHEDULES['u1']
    },
    {
        id: 'u2',
        name: 'Receptionist Mona',
        role: UserRole.RECEPTIONIST,
        assignedBranches: ['b1', 'b2'],
    }
];

const MOCK_BRANCHES: Branch[] = [
    { id: 'b1', name: 'Al-Fath Main Branch', location: 'Downtown', contactPhone: '010000000', isActive: true },
    { id: 'b2', name: 'Al-Fath Alex Branch', location: 'Alexandria', contactPhone: '011000000', isActive: true },
];

let activeCashSessions: Record<string, CashSessionData> = {};

const createEnvelope = (data: any) => ({ data });

export const handleMockRequest = async <T>(path: string, options: RequestInit): Promise<T> => {
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(path, 'http://mock');
    const pathname = url.pathname;
    const body = options.body ? JSON.parse(options.body as string) : {};

    // Simulate network delay
    await new Promise(r => setTimeout(r, 150));

    console.log(`[MOCK ENGINE] Intercepted ${method} ${pathname}`);

    try {
        // ---- AUTH ----
        if (pathname === '/auth/login' && method === 'POST') {
            const { email } = body;
            const user = MOCK_USERS.find(u => u.email === email || u.name === email) || MOCK_USERS[0];
            return createEnvelope({ token: 'mock-token-123', user, clinicId: 'c1' }) as unknown as T;
        }
        if (pathname === '/auth/user' && method === 'GET') {
            return createEnvelope(MOCK_USERS[0]) as unknown as T;
        }

        // ---- BRANCHES ----
        if (pathname === '/branches' && method === 'GET') {
            return createEnvelope(MOCK_BRANCHES) as unknown as T;
        }

        // ---- USERS / DOCTORS / EMPLOYEES ----
        if (pathname === '/doctors' && method === 'GET') {
            return createEnvelope(MOCK_USERS.filter(u => u.role === UserRole.DOCTOR)) as unknown as T;
        }
        if (pathname === '/employees' && method === 'GET') {
            return createEnvelope(MOCK_EMPLOYEES) as unknown as T;
        }

        // ---- PATIENTS ----
        if (pathname === '/patients' && method === 'GET') {
            return createEnvelope(memoryPatients) as unknown as T;
        }
        if (pathname === '/patients' && method === 'POST') {
            const newPatient: Patient = {
                id: `p${Date.now()}`,
                name: body.name,
                phone: body.phone,
                gender: body.gender,
                age: body.age,
                medicalHistorySummary: body.medicalHistorySummary || '',
                lastVisit: null,
                allergies: [],
                chronicConditions: [],
                balance: 0
            };
            memoryPatients.push(newPatient);
            return createEnvelope(newPatient) as unknown as T;
        }

        // ---- APPOINTMENTS ----
        if (pathname === '/appointments/available-slots' && method === 'GET') {
            const dateStr = url.searchParams.get('date');
            const doctorId = url.searchParams.get('doctor_id');
            if (dateStr && doctorId) {
                const slots = generateTimeSlots(dateStr, doctorId);
                return createEnvelope(slots) as unknown as T;
            }
            return createEnvelope([]) as unknown as T;
        }
        if (pathname === '/appointments' && method === 'GET') {
            const date = url.searchParams.get('date');
            let apts = [...memoryAppointments];
            if (date) apts = apts.filter(a => a.date === date);
            return createEnvelope(apts) as unknown as T;
        }
        if (pathname === '/appointments' && method === 'POST') {
            const patient = memoryPatients.find(p => p.id === body.patientId) || memoryPatients[0];
            const doctor = MOCK_USERS.find(u => u.id === String(body.doctorId)) || MOCK_USERS[1];
            const newApt: Appointment = {
                id: `apt${Date.now()}`,
                patientId: patient.id,
                patientName: patient.name,
                doctorId: doctor.id,
                doctorName: doctor.name,
                branchId: String(body.branchId),
                date: body.date,
                timeSlot: body.timeSlot,
                department: Department.INTERNAL_MEDICINE,
                status: body.status,
                type: 'Consultation',
                createdAt: new Date().toISOString(),
                billing: {
                    items: [], subtotal: 0, discount: 0, total: 0, paidAmount: 0, status: PaymentStatus.UNPAID, transactions: []
                }
            };
            memoryAppointments.push(newApt);
            return createEnvelope(newApt) as unknown as T;
        }
        if (pathname.match(/^\/appointments\/[^\/]+\/status$/) && method === 'POST') {
            const id = pathname.split('/')[2];
            const apt = memoryAppointments.find(a => a.id === id);
            if (apt) apt.status = body.status;
            return createEnvelope(apt) as unknown as T;
        }

        // ---- CASH SESSIONS ----
        if (pathname === '/cash-sessions/active' && method === 'GET') {
            const bId = url.searchParams.get('branch_id') || '1';
            return createEnvelope(activeCashSessions[bId] || null) as unknown as T;
        }
        if (pathname === '/cash-sessions/open' && method === 'POST') {
            const bId = String(body.branch_id);
            const session: CashSessionData = {
                id: `cs${Date.now()}`,
                branchId: bId,
                openingBalance: body.opening_balance,
                expectedCash: body.opening_balance,
                collectedCash: null,
                variance: null,
                status: 'OPEN',
                openedAt: new Date().toISOString(),
                closedAt: null
            };
            activeCashSessions[bId] = session;
            return createEnvelope(session) as unknown as T;
        }
        if (pathname.match(/^\/cash-sessions\/[^\/]+\/close$/) && method === 'POST') {
            const id = pathname.split('/')[2];
            let closedSession = null;
            Object.values(activeCashSessions).forEach(s => {
                if (s.id === id) {
                    s.status = 'CLOSED';
                    s.collectedCash = body.collected_cash;
                    s.variance = s.collectedCash - s.expectedCash;
                    s.closedAt = new Date().toISOString();
                    closedSession = s;
                }
            });
            if (closedSession) {
                delete activeCashSessions[(closedSession as CashSessionData).branchId];
            }
            return createEnvelope(closedSession) as unknown as T;
        }

        // ---- DASHBOARD & REPORTS ----
        if (pathname === '/dashboard/stats' && method === 'GET') {
            return createEnvelope({
                totalPatients: memoryPatients.length,
                todayAppointments: memoryAppointments.length,
                todayRevenue: 5000,
                activeDoctors: MOCK_USERS.filter(u => u.role === UserRole.DOCTOR).length
            }) as unknown as T;
        }
        if (pathname === '/dashboard/revenue' && method === 'GET') {
            return createEnvelope([
                { date: '2023-11-01', amount: 1200 },
                { date: '2023-11-02', amount: 3000 },
                { date: '2023-11-03', amount: 2500 },
                { date: '2023-11-04', amount: 4000 }
            ]) as unknown as T;
        }

        // ---- DOCTOR PROFILE ----
        if (pathname === '/doctor-profile' && method === 'GET') {
            return createEnvelope({
                examFindingTemplates: [],
                diagnosisTemplates: [],
                planTemplates: [],
                doctorAdvancedModeEnabled: false,
                doctorAdvancedCapabilities: undefined,
                isPlatformAdmin: false
            }) as unknown as T;
        }

        // ---- CLINIC SETTINGS ----
        if (pathname === '/clinic/settings' && method === 'GET') {
            return createEnvelope({
                name: 'Al-Fath Clinic',
                email: 'contact@alfath.com',
                phone: '01000000000',
                website: 'www.alfath.com',
                timezone: 'Africa/Cairo',
                currency: 'EGP',
                logoUrl: '',
                commission_basis: 'PAID_AMOUNT',
                apply_on_discounted_amount: false,
                include_tax: false,
                clawback_on_refund: false,
                accrual_day_of_month: 1,
                tv_queue_display_mode: 'FULL_NAME'
            }) as unknown as T;
        }
        if (pathname === '/clinic/settings' && method === 'PUT') {
            return createEnvelope(body) as unknown as T;
        }

        // ---- BILLING ----
        if (pathname.match(/^\/appointments\/[^\/]+\/billing\/items$/) && method === 'POST') {
            const id = pathname.split('/')[2];
            const apt = memoryAppointments.find(a => a.id === id);
            if (apt) {
                const qty = body.quantity || 1;
                const newItem = {
                    id: `itm${Date.now()}`,
                    serviceId: body.serviceId || 'srv_custom',
                    name: body.name,
                    category: body.category || 'General',
                    quantity: qty,
                    unitPrice: body.unitPrice,
                    total: qty * body.unitPrice,
                    addedBy: 'mock-user',
                    timestamp: new Date().toISOString()
                };
                apt.billing.items = [...(apt.billing.items || []), newItem];
                apt.billing.subtotal = apt.billing.items.reduce((acc, i) => acc + i.total, 0);
                apt.billing.total = apt.billing.subtotal - apt.billing.discount;
            }
            return createEnvelope(apt) as unknown as T;
        }

        if (pathname.match(/^\/appointments\/[^\/]+\/billing\/items\/[^\/]+$/) && method === 'DELETE') {
            const parts = pathname.split('/');
            const id = parts[2];
            const itemId = parts[5];
            const apt = memoryAppointments.find(a => a.id === id);
            if (apt && apt.billing.items) {
                apt.billing.items = apt.billing.items.filter((i: any) => i.id !== itemId);
                apt.billing.subtotal = apt.billing.items.reduce((acc, i) => acc + i.total, 0);
                apt.billing.total = apt.billing.subtotal - apt.billing.discount;
            }
            return createEnvelope(apt) as unknown as T;
        }

        if (pathname.match(/^\/appointments\/[^\/]+\/billing\/payments$/) && method === 'POST') {
            const id = pathname.split('/')[2];
            const apt = memoryAppointments.find(a => a.id === id);
            if (apt) {
                apt.billing.paidAmount += body.amount || (body.payments ? body.payments.reduce((acc: number, p: any) => acc + p.amount, 0) : 0);
                if (apt.billing.paidAmount >= apt.billing.total) {
                    apt.billing.status = PaymentStatus.PAID;
                } else if (apt.billing.paidAmount > 0) {
                    apt.billing.status = PaymentStatus.PARTIAL;
                }
            }
            return createEnvelope(apt) as unknown as T;
        }

        // Fallback Mock
        console.warn(`[MOCK ENGINE] Unhandled route: ${method} ${pathname}`);
        return createEnvelope([]) as unknown as T;

    } catch (error) {
        console.error('[MOCK ENGINE ERROR]', error);
        throw new Error('Mock Engine failed processing request');
    }
};
