import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { AdminDashboardContent } from '@/components/admin/admin-dashboard-content';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Dashboard',
};

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  todayAppointments: number;
  weekAppointments: number;
  pendingOrders: number;
  monthlyRevenue: number;
  newCustomers: number;
  cancelledAppointments: number;
}

interface TodayAppointment {
  id: string;
  time: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  duration: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string;
  totalCents: number;
  status: string;
  createdAt: string;
}

// Supabase row types
interface DashboardAppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  customer_name: string | null;
  customers: {
    first_name: string;
    last_name: string;
  } | null;
  appointment_services: {
    service_name: string;
    duration_minutes: number;
  }[] | null;
  staff: {
    display_name: string;
  } | null;
}

interface MonthlyOrderRow {
  total_cents: number | null;
}

interface RecentOrderRow {
  id: string;
  order_number: string;
  customer_email: string;
  total_cents: number;
  status: string;
  created_at: string;
}

// ============================================
// DATA FETCHING
// ============================================

async function getDashboardData() {
  const supabase = createServiceRoleClient();

  if (!supabase) {
    console.error('[Dashboard] Service role client not available');
    return {
      stats: {
        todayAppointments: 0,
        weekAppointments: 0,
        pendingOrders: 0,
        monthlyRevenue: 0,
        newCustomers: 0,
        cancelledAppointments: 0,
      },
      todayAppointments: [],
      recentOrders: [],
    };
  }

  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  // Calculate start of week (Monday)
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days from Monday
  startOfWeek.setDate(today.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // Calculate end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get today's appointments (using appointment_services for service info)
  const { data: todayAppointmentsData, count: todayCount } = await supabase
    .from('appointments')
    .select(
      `
      id,
      start_time,
      end_time,
      status,
      customer_name,
      customers (
        first_name,
        last_name
      ),
      appointment_services (
        service_name,
        duration_minutes
      ),
      staff (
        display_name
      )
    `,
      { count: 'exact' }
    )
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .neq('status', 'cancelled')
    .order('start_time', { ascending: true }) as { data: DashboardAppointmentRow[] | null; count: number | null };

  // Get week appointments count
  const { count: weekCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', startOfWeek.toISOString())
    .lte('start_time', endOfWeek.toISOString())
    .neq('status', 'cancelled');

  // Get pending orders count
  const { count: pendingOrdersCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'paid', 'processing']);

  // Get monthly revenue
  const { data: monthlyOrders } = await supabase
    .from('orders')
    .select('total_cents')
    .gte('created_at', startOfMonth.toISOString())
    .eq('payment_status', 'succeeded') as { data: MonthlyOrderRow[] | null };

  const monthlyRevenue = monthlyOrders?.reduce(
    (sum, order) => sum + (order.total_cents || 0),
    0
  ) || 0;

  // Get new customers this month
  const { count: newCustomersCount } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString());

  // Get cancelled appointments today
  const { count: cancelledCount } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .eq('status', 'cancelled');

  // Get recent orders
  const { data: recentOrdersData } = await supabase
    .from('orders')
    .select('id, order_number, customer_email, total_cents, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5) as { data: RecentOrderRow[] | null };

  // Transform appointments data
  const todayAppointments: TodayAppointment[] = (todayAppointmentsData || []).map(
    (apt) => {
      // Get customer name from linked customer or denormalized field
      const customerName = apt.customers
        ? `${apt.customers.first_name} ${apt.customers.last_name}`
        : apt.customer_name || 'Unbekannt';

      // Get service info from appointment_services
      const firstService = apt.appointment_services?.[0];
      const serviceName = firstService?.service_name || 'Unbekannt';
      const duration = firstService?.duration_minutes || 30;

      return {
        id: apt.id,
        time: new Date(apt.start_time).toLocaleTimeString('de-CH', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        customerName,
        serviceName,
        staffName: apt.staff?.display_name || 'Unbekannt',
        status: apt.status as TodayAppointment['status'],
        duration,
      };
    }
  );

  // Transform orders data
  const recentOrders: RecentOrder[] = (recentOrdersData || []).map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerEmail: order.customer_email,
    totalCents: order.total_cents,
    status: order.status,
    createdAt: order.created_at,
  }));

  const stats: DashboardStats = {
    todayAppointments: todayCount || 0,
    weekAppointments: weekCount || 0,
    pendingOrders: pendingOrdersCount || 0,
    monthlyRevenue,
    newCustomers: newCustomersCount || 0,
    cancelledAppointments: cancelledCount || 0,
  };

  return {
    stats,
    todayAppointments,
    recentOrders,
  };
}

// ============================================
// ADMIN DASHBOARD PAGE
// ============================================

export default async function AdminDashboardPage() {
  const { stats, todayAppointments, recentOrders } = await getDashboardData();

  return (
    <AdminDashboardContent
      stats={stats}
      todayAppointments={todayAppointments}
      recentOrders={recentOrders}
    />
  );
}
