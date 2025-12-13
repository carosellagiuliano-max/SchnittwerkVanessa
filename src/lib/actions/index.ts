// ============================================
// SCHNITTWERK Server Actions
// ============================================

// Salon data
export {
  getSalon,
  getOpeningHours,
  getServicesWithCategories,
  getBookableServices,
  getAddonServices,
  getPublicSalonData,
  updateOpeningHours,
  type Salon,
  type OpeningHour,
  type ServiceCategory,
  type Service,
  type ServiceLengthVariant,
  type AddonService,
  type UpdateOpeningHoursInput,
  type UpdateOpeningHoursResult,
} from './salon';

// Staff data
export {
  getStaffMembers,
  getBookableStaff,
  getStaffWorkingHours,
  getStaffAbsences,
  getStaffSkills,
  type StaffMember,
  type StaffWorkingHours,
  type StaffAbsence,
} from './staff';

// Products data
export {
  getProductCategories,
  getProducts,
  getProductsWithCategories,
  getFeaturedProducts,
  getProductBySlug,
  getProductsByCategory,
  type ProductCategory,
  type Product,
  type ProductWithCategory,
} from './products';

// Contact form
export {
  submitContactForm,
  type ContactFormData,
  type ContactFormResult,
} from './contact';

// Booking
export {
  getBookingPageData,
  getExistingAppointments,
  getStaffAbsencesForDateRange,
  getBlockedTimes,
  createAppointmentReservation,
  confirmAppointment,
  markAppointmentNoShow,
  markAppointmentCompleted,
  type BookingPageData,
  type CreateReservationResult,
  type NoShowResult,
  type CompleteResult,
} from './booking';

// Auth
export {
  registerCustomer,
  loginCustomer,
  requestPasswordReset,
  updatePassword,
  getCurrentUser,
  logout,
  type RegisterResult,
  type LoginResult,
  type PasswordResetResult,
} from './auth';

// Customer
export {
  getCustomerAppointments,
  getUpcomingAppointments,
  cancelAppointment,
  getCustomerProfile,
  updateCustomerProfile,
  type CustomerAppointment,
  type CustomerProfile,
  type CancelResult,
  type UpdateProfileResult,
} from './customer';

// Service Management (Admin CRUD)
export {
  getServiceCategories,
  getAllServicesForAdmin,
  createService,
  updateService,
  deleteService,
  restoreService,
  type ServiceForAdmin,
  type CreateServiceInput,
  type UpdateServiceInput,
  type ServiceResult,
} from './services';
