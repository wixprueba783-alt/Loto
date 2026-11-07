import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { APPOINTMENTS, BRANCH_LABEL, MONTHS, getAppointmentPaymentSummary } from '../../data';
import { Download, LoaderCircle, TrendingUp, TrendingDown } from 'lucide-react';
import type { AppointmentStatus, BranchId, PaymentMethod } from '../../types';
import { createXlsxBlob } from '../../xlsx';

const MONTH_WINDOW = 6;

const paymentMethodLabel: Record<PaymentMethod, string> = { transfer: 'Transferencia', cash: 'Efectivo', card: 'Tarjeta' };

const roseChartColors = ['#E8778A', '#C1536A', '#FECDD5', '#F5EDE6', '#9D3050', '#BBA9AD'];
const oliveChartColors = ['#BBC58E', '#899765', '#D8DEBE', '#E5E8D8', '#66734A', '#AEB895'];

type ReportPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getReportDateRange(period: ReportPeriod, startDate: string, endDate: string, now: Date) {
  const today = localDateKey(now);
  if (period === 'day') return [today, today] as const;
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return [localDateKey(start), localDateKey(end)] as const;
  }
  if (period === 'month') {
    return [
      localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    ] as const;
  }
  if (period === 'year') {
    return [
      localDateKey(new Date(now.getFullYear(), 0, 1)),
      localDateKey(new Date(now.getFullYear(), 11, 31)),
    ] as const;
  }
  return [startDate, endDate] as const;
}

export function AdminStatsPage({ branchId }: { branchId: BranchId }) {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customStartDate, setCustomStartDate] = useState(() => localDateKey(new Date()));
  const [customEndDate, setCustomEndDate] = useState(() => localDateKey(new Date()));
  const [serviceFilter, setServiceFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | ''>('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const chartColors = branchId === 'north' ? oliveChartColors : roseChartColors;
  const branchAppointments = APPOINTMENTS.filter(appointment => (appointment.branchId ?? 'main') === branchId);
  const [rangeStart, rangeEnd] = getReportDateRange(period, customStartDate, customEndDate, new Date());
  const reportAppointments = branchAppointments.filter(appointment => {
    if (appointment.date < rangeStart || appointment.date > rangeEnd) return false;
    if (serviceFilter && !(appointment.services ?? [appointment.service]).some(service => service.name === serviceFilter)) return false;
    if (paymentFilter && !getAppointmentPaymentSummary(appointment).payments.some(payment => payment.method === paymentFilter)) return false;
    if (statusFilter && appointment.status !== statusFilter) return false;
    return true;
  });
  const reportRevenue = reportAppointments.reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).paid, 0);
  const serviceOptions = Array.from(new Set(branchAppointments.flatMap(appointment =>
    (appointment.services ?? [appointment.service]).map(service => service.name),
  ))).sort((a, b) => a.localeCompare(b, 'es'));

  async function exportReport() {
    setExporting(true);
    setExportError('');
    try {
      const rows: (string | number)[][] = [
        ['Folio', 'Fecha', 'Hora', 'Cliente', 'Servicio', 'Estado', 'Método de pago', 'Pagado', 'Total'],
      ];
      for (const appointment of reportAppointments) {
        const payments = getAppointmentPaymentSummary(appointment).payments;
        rows.push([
          appointment.ticketFolio || appointment.id,
          appointment.date,
          appointment.time,
          appointment.clientName,
          (appointment.services ?? [appointment.service]).map(service => service.name).join(', '),
          appointment.status,
          [...new Set(payments.map(payment => paymentMethodLabel[payment.method]))].join(', ') || 'Sin pago',
          getAppointmentPaymentSummary(appointment).paid,
          appointment.total,
        ]);
      }
      const blob = createXlsxBlob(`Reporte ${BRANCH_LABEL[branchId]}`, rows);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_${branchId === 'north' ? 'Escobedo' : 'San_Nicolas'}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('No se pudo exportar el reporte de la sucursal:', error);
      setExportError(error instanceof Error ? error.message : 'No se pudo generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  }

  // Últimos 6 meses naturales, incluyendo el mes actual.
  const now = new Date();
  const monthKeys = Array.from({ length: MONTH_WINDOW }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (MONTH_WINDOW - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthlyData = monthKeys.map(key => {
    const monthAppointments = branchAppointments.filter(appointment =>
      typeof appointment.date === 'string' && appointment.date.slice(0, 7) === key);
    return {
      month: MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3),
      citas: monthAppointments.length,
      ingresos: monthAppointments.reduce((sum, appointment) => sum + getAppointmentPaymentSummary(appointment).paid, 0),
      canceladas: monthAppointments.filter(appointment => appointment.status === 'cancelled').length,
    };
  });

  // Distribución de servicios: top 5 + "Otros", en porcentaje.
  const serviceCounts = new Map<string, number>();
  branchAppointments.forEach(appointment => {
    (appointment.services ?? [appointment.service]).forEach(service => {
      serviceCounts.set(service.name, (serviceCounts.get(service.name) ?? 0) + 1);
    });
  });
  const serviceEntries = Array.from(serviceCounts.entries()).sort(([, a], [, b]) => b - a);
  const totalServices = serviceCounts.size > 0
    ? Array.from(serviceCounts.values()).reduce((sum, count) => sum + count, 0)
    : 0;
  const toPercent = (count: number) => totalServices > 0 ? Math.round((count / totalServices) * 100) : 0;
  const serviceDistrib = serviceEntries.slice(0, 5).map(([name, count]) => ({ name, value: toPercent(count) }));
  const othersCount = serviceEntries.slice(5).reduce((sum, [, count]) => sum + count, 0);
  if (serviceEntries.length > 5) serviceDistrib.push({ name: 'Otros', value: toPercent(othersCount) });

  // Montos cobrados por método de pago (citas canceladas aportan 0).
  const paidByMethod = { transfer: 0, cash: 0, card: 0 } as Record<PaymentMethod, number>;
  branchAppointments.forEach(appointment => {
    getAppointmentPaymentSummary(appointment).payments.forEach(payment => {
      paidByMethod[payment.method] += Math.max(0, Number(payment.amount) || 0);
    });
  });
  const totalPaid = paidByMethod.transfer + paidByMethod.cash + paidByMethod.card;
  const paymentDistrib = (['transfer', 'cash', 'card'] as PaymentMethod[]).map(method => ({
    name: paymentMethodLabel[method],
    value: totalPaid > 0 ? Math.round((paidByMethod[method] / totalPaid) * 100) : 0,
  }));

  const totalRevenue = monthlyData.reduce((s, d) => s + d.ingresos, 0);
  const totalAppts = monthlyData.reduce((s, d) => s + d.citas, 0);
  const avgPerAppt = totalAppts > 0 ? Math.round(totalRevenue / totalAppts) : 0;
  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const growth = prevMonth && prevMonth.ingresos > 0
    ? Math.round(((lastMonth.ingresos - prevMonth.ingresos) / prevMonth.ingresos) * 100)
    : 0;

  const services = serviceDistrib.map((entry, index) => ({ ...entry, color: chartColors[index] }));
  const payments = paymentDistrib.map((entry, index) => ({ ...entry, color: chartColors[index] }));

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-700 text-[var(--color-text)]">Reporte de {BRANCH_LABEL[branchId]}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {reportAppointments.length} citas · ${reportRevenue.toLocaleString()} cobrados
            </p>
          </div>
          <button type="button" className="btn-primary justify-center" onClick={() => void exportReport()} disabled={exporting}>
            {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? 'Generando...' : 'Exportar Excel'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs text-[var(--color-text-muted)]">
            Periodo
            <select className="input-field w-full" value={period} onChange={event => setPeriod(event.target.value as ReportPeriod)}>
              <option value="day">Día (hoy)</option>
              <option value="week">Semana actual</option>
              <option value="month">Mes actual</option>
              <option value="year">Año actual</option>
              <option value="custom">Periodo personalizado</option>
            </select>
          </label>
          {period === 'custom' && <>
            <label className="space-y-1 text-xs text-[var(--color-text-muted)]">
              Desde
              <input className="input-field w-full" type="date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-[var(--color-text-muted)]">
              Hasta
              <input className="input-field w-full" type="date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} />
            </label>
          </>}
          <label className="space-y-1 text-xs text-[var(--color-text-muted)]">
            Servicio
            <select className="input-field w-full" value={serviceFilter} onChange={event => setServiceFilter(event.target.value)}>
              <option value="">Todos</option>
              {serviceOptions.map(service => <option key={service} value={service}>{service}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-[var(--color-text-muted)]">
            Método de pago
            <select className="input-field w-full" value={paymentFilter} onChange={event => setPaymentFilter(event.target.value as PaymentMethod | '')}>
              <option value="">Todos</option>
              {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map(method => <option key={method} value={method}>{paymentMethodLabel[method]}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-[var(--color-text-muted)]">
            Estado de cita
            <select className="input-field w-full" value={statusFilter} onChange={event => setStatusFilter(event.target.value as AppointmentStatus | '')}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmada</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
        </div>
        {exportError && <p className="text-sm text-red-600" role="alert">{exportError}</p>}
      </section>
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos totales', value: `$${totalRevenue.toLocaleString()}`, sub: '6 meses', up: true },
          { label: 'Total citas', value: totalAppts, sub: '6 meses', up: true },
          { label: 'Ticket promedio', value: `$${avgPerAppt}`, sub: 'por cita', up: true },
          { label: 'Crecimiento', value: `${growth > 0 ? '+' : ''}${growth}%`, sub: 'vs mes anterior', up: growth >= 0 },
        ].map((kpi, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between mb-1">
              <div className="text-xs text-[#6B5A5E] font-500">{kpi.label}</div>
              {kpi.up ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-red-500" />}
            </div>
            <div className="text-2xl font-700 text-[#C1536A]">{kpi.value}</div>
            <div className="text-xs text-[#BBA9AD] mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue + appointments chart */}
      <div className="card p-5">
        <h3 className="font-700 text-[#1A1012] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Ingresos y citas por mes
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
            <Line yAxisId="left" type="monotone" dataKey="ingresos" stroke={chartColors[0]} strokeWidth={2.5} dot={{ r: 4, fill: chartColors[0] }} name="Ingresos ($)" />
            <Line yAxisId="right" type="monotone" dataKey="citas" stroke={chartColors[1]} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: chartColors[1] }} name="Citas" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-700 text-[#1A1012] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Servicios más solicitados
          </h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={services} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  dataKey="value" paddingAngle={2}>
                  {services.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {services.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-[#6B5A5E]">{s.name}</span>
                  </div>
                  <span className="text-xs font-700 text-[#1A1012]">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-700 text-[#1A1012] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Métodos de pago
          </h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={payments} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  dataKey="value" paddingAngle={2}>
                  {payments.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {payments.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-[#6B5A5E]">{s.name}</span>
                  </div>
                  <span className="text-xs font-700 text-[#1A1012]">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation rate */}
      <div className="card p-5">
        <h3 className="font-700 text-[#1A1012] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Citas vs. canceladas por mes
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-text)', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
            <Bar dataKey="citas" fill={chartColors[2]} radius={[4, 4, 0, 0]} name="Citas totales" />
            <Bar dataKey="canceladas" fill={chartColors[0]} radius={[4, 4, 0, 0]} name="Canceladas" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
