import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Define translations
const resources = {
  en: {
    translation: {
      // General
      "clinic_name": "Al-Fath Clinic",
      "search": "Search...",
      "welcome": "Welcome",
      "notifications": "Notifications",
      "current_branch": "Current Branch",
      "view_all": "View All",
      "loading": "Loading...",
      "actions": "Actions",
      
      // Auth / Login
      "login_title": "Al-Fath Clinic",
      "login_subtitle": "Advanced Multi-Branch Management System",
      "staff_login": "Staff Login",
      "book_online": "Book Appointment Online (Patient Portal)",
      "or_staff_login": "Or Staff Login",
      "login_as": "Login as",
      
      // Navigation
      "dashboard": "Dashboard",
      "appointments": "Appointments",
      "queue_board": "Queue Board",
      "patients": "Patients",
      "doctors": "Doctors",
      "staff_hr": "Staff & HR",
      "branches": "Branches",
      "reports": "Reports",
      "settings": "Settings",
      "sign_out": "Sign Out",
      "workspace": "Workspace",
      "management": "Management",
      "finance": "Finance",

      // Dashboard KPIs
      "total_revenue": "Total Revenue",
      "active_doctors": "Active Doctors",
      "across_branches": "Across all branches",
      "active_branches": "Active Branches",
      "avg_utilization": "Avg Utilization",
      "revenue_analytics": "Revenue Analytics",
      "weekly_income": "Weekly income overview",
      "last_7_days": "Last 7 Days",
      "visits_by_dept": "Visits by Department",
      "patient_distribution": "Patient distribution today",
      "recent_appointments": "Recent Appointments",
      "recent_activity": "Recent Activity",
      
      // Roles
      "ADMIN": "Admin",
      "BRANCH_MANAGER": "Branch Manager",
      "DOCTOR": "Doctor",
      "RECEPTIONIST": "Receptionist",
      "NURSE": "Nurse",
      "PHARMACY_MANAGER": "Pharmacy Manager",

      // Table Headers
      "patient": "Patient",
      "doctor": "Doctor",
      "status": "Status",
      "time": "Time",
      
      // Appointment Status
      "SCHEDULED": "Scheduled",
      "WAITING": "Waiting",
      "IN_PROGRESS": "In Progress",
      "COMPLETED": "Completed",
      "CANCELLED": "Cancelled",
      "NO_SHOW": "No Show",
      "CALLED": "Called"
    }
  },
  ar: {
    translation: {
      // General
      "clinic_name": "عيادات الفتح",
      "search": "بحث...",
      "welcome": "مرحباً",
      "notifications": "الإشعارات",
      "current_branch": "الفرع الحالي",
      "view_all": "عرض الكل",
      "loading": "جاري التحميل...",
      "actions": "إجراءات",

      // Auth / Login
      "login_title": "عيادات الفتح",
      "login_subtitle": "نظام إدارة العيادات المتعدد الفروع",
      "staff_login": "دخول الموظفين",
      "book_online": "حجز موعد أونلاين (بوابة المرضى)",
      "or_staff_login": "أو دخول الطاقم الطبي والإداري",
      "login_as": "الدخول بصفة",

      // Navigation
      "dashboard": "لوحة التحكم",
      "appointments": "المواعيد",
      "queue_board": "لوحة الانتظار",
      "patients": "المرضى",
      "doctors": "الأطباء",
      "staff_hr": "الموظفين والموارد البشرية",
      "branches": "الفروع",
      "reports": "التقارير المالية",
      "settings": "الإعدادات",
      "sign_out": "تسجيل الخروج",
      "workspace": "مساحة العمل",
      "management": "الإدارة",
      "finance": "المالية",

      // Dashboard KPIs
      "total_revenue": "إجمالي الإيرادات",
      "active_doctors": "الأطباء المناوبين",
      "across_branches": "في جميع الفروع",
      "active_branches": "الفروع النشطة",
      "avg_utilization": "معدل الإشغال",
      "revenue_analytics": "تحليل الإيرادات",
      "weekly_income": "نظرة عامة أسبوعية",
      "last_7_days": "آخر 7 أيام",
      "visits_by_dept": "الزيارات حسب القسم",
      "patient_distribution": "توزيع المرضى اليوم",
      "recent_appointments": "أحدث المواعيد",
      "recent_activity": "النشاط الأخير",

      // Roles
      "ADMIN": "مدير النظام",
      "BRANCH_MANAGER": "مدير فرع",
      "DOCTOR": "طبيب",
      "RECEPTIONIST": "موظف استقبال",
      "NURSE": "تمريض",
      "PHARMACY_MANAGER": "مدير صيدلية",

      // Table Headers
      "patient": "المريض",
      "doctor": "الطبيب",
      "status": "الحالة",
      "time": "الوقت",

      // Appointment Status
      "SCHEDULED": "مجدول",
      "WAITING": "في الانتظار",
      "IN_PROGRESS": "مع الطبيب",
      "COMPLETED": "مكتمل",
      "CANCELLED": "ملغي",
      "NO_SHOW": "لم يحضر",
      "CALLED": "تم الاستدعاء"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;