import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { APPOINTMENTS, MONTHS } from '../../data';
import { CalendarDays, CheckCircle, XCircle, Clock, DollarSign, TrendingUp } from 'lucide-react';
import type { BranchId } from '../../types';

const weekData = [
  { day: 'Lun', citas: 4, ingresos: 1480 },
  { day: 'Mar', citas: 6, ingresos: 2200 },
  { day: 'Mié', citas: 3, ingresos: 1050 },
  { day: 'Jue', citas: 7, ingresos: 2630 },
  { day: 'Vie', citas: 5, ingresos: 1900 },
  { day: 'Sáb', citas: 8, ingresos: 3200 },
  { day: 'Dom', citas: 0, ingresos: 0 },
];

const serviceData = [
  { name: 'Gel semipermanente', value: 28 },
  { name: 'Acrílicas', value: 22 },
  { name: 'Manicura', value: 18 },
  { name: 'Pedicura', value: 15 },
  { name: 'Arte en uñas', value: 10 },
  { name: 'Otros', value: 7 },
];

export function DashboardPage({ branchId }: { branchId: BranchId }) {
  const chartColors = branchId === 'north'
    ? { primary: '#BBC58E', secondary: '#899765', tertiary: '#66734A' }
    : { primary: '#E8778A', secondary: '#C1536A', tertiary: '#9D3050' };
  const branchAppointments = APPOINTMENTS.filter(appointment => (appointment.branchId ?? 'main') === branchId);
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayLabel = `${today.getDate()} ${MONTHS[today.getMonth()].slice(0, 3)} ${today.getFullYear()}`;
  const pending = branchAppointments.filter(a => a.status === 'pending').length;
  const confirmed = branchAppointments.filter(a => a.status === 'confirmed').length;
  const cancelled = branchAppointments.filter(a => a.status === 'cancelled').length;
  const todayAppointments = branchAppointments.filter(a => a.date === todayDate);
  const revenue = branchAppointments.filter(a => a.status === 'completed')
    .reduce((s, a) => s + a.payments.reduce((ps, p) => ps + p.amount, 0), 0);

  const stats = [
    { label: 'Pendientes', value: pending, icon: <Clock size={20} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Confirmadas', value: confirmed, icon: <CheckCircle size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Canceladas', value: cancelled, icon: <XCircle size={20} />, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
    { label: 'Citas hoy', value: todayAppointments.length, icon: <CalendarDays size={20} />, color: 'text-[#E8778A]', bg: 'bg-[#FFF1F3]', border: 'border-[#FECDD5]' },
    { label: 'Ingresos', value: `$${revenue}`, icon: <DollarSign size={20} />, color: 'text-[#C1536A]', bg: 'bg-[#FFF1F3]', border: 'border-[#FECDD5]' },
    { label: 'Total citas', value: branchAppointments.length, icon: <TrendingUp size={20} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`stat-card border ${s.border}`}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <div className={`text-2xl font-700 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-[#6B5A5E] font-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-700 text-[#1A1012] mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <TrendingUp size={16} className="text-[#E8778A]" /> Citas e ingresos esta semana
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id={`citasGrad-${branchId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`ingGrad-${branchId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
              <Area type="monotone" dataKey="citas" stroke={chartColors.primary} fill={`url(#citasGrad-${branchId})`} strokeWidth={2} name="Citas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-700 text-[#1A1012] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Servicios más solicitados
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={serviceData} layout="vertical" barSize={10}>
              <CartesianGrid stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={68} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 12 }} />
              <Bar dataKey="value" fill={chartColors.primary} radius={[0, 4, 4, 0]} name="Citas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's appointments */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-[#F5EDE6] flex items-center justify-between">
          <h3 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Citas de hoy</h3>
          <span className="text-xs text-[#BBA9AD] font-500">{todayLabel}</span>
        </div>
        <div className="divide-y divide-[#F5EDE6]">
          {todayAppointments.map(appt => (
            <div key={appt.id} className="p-3 flex items-center gap-4 table-row whitespace-nowrap overflow-x-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FFF1F3] flex items-center justify-center text-[#C1536A] text-sm font-700">
                  {appt.time}
                </div>
                <div>
                  <div className="text-sm font-600 text-[#1A1012]">{appt.clientName}</div>
                  <div className="text-xs text-[#6B5A5E]">{(appt.services ?? [appt.service]).map(service => service.name).join(' + ')}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm font-600 text-[#C1536A]">${appt.total}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-600 border status-chip ${
                  appt.status === 'confirmed' ? 'status-chip-success' :
                  'status-chip-warning'
                }`}>
                  {appt.status === 'confirmed' ? 'Confirmada' : appt.status === 'completed' ? 'Completada' : appt.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                </span>
              </div>
            </div>
          ))}
          {todayAppointments.length === 0 && (
            <div className="p-8 text-center text-[#BBA9AD] text-sm">No hay citas para hoy</div>
          )}
        </div>
      </div>
    </div>
  );
}
