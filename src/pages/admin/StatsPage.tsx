import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { APPOINTMENTS } from '../../data';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { BranchId } from '../../types';

const monthlyData = [
  { month: 'Abr', citas: 32, ingresos: 12800, canceladas: 3 },
  { month: 'May', citas: 45, ingresos: 17550, canceladas: 4 },
  { month: 'Jun', citas: 38, ingresos: 14820, canceladas: 2 },
  { month: 'Jul', citas: 52, ingresos: 20280, canceladas: 5 },
  { month: 'Ago', citas: 60, ingresos: 23400, canceladas: 4 },
  { month: 'Sep', citas: 47, ingresos: 18330, canceladas: 3 },
];

const serviceDistrib = [
  { name: 'Gel semipermanente', value: 28 },
  { name: 'Acrílicas', value: 22 },
  { name: 'Manicura', value: 18 },
  { name: 'Pedicura', value: 15 },
  { name: 'Arte en uñas', value: 10 },
  { name: 'Otros', value: 7 },
];

const paymentDistrib = [
  { name: 'Transferencia', value: 45 },
  { name: 'Efectivo', value: 35 },
  { name: 'Tarjeta', value: 20 },
];

const roseChartColors = ['#E8778A', '#C1536A', '#FECDD5', '#F5EDE6', '#9D3050', '#BBA9AD'];
const oliveChartColors = ['#BBC58E', '#899765', '#D8DEBE', '#E5E8D8', '#66734A', '#AEB895'];

export function AdminStatsPage({ branchId }: { branchId: BranchId }) {
  const chartColors = branchId === 'north' ? oliveChartColors : roseChartColors;
  const services = serviceDistrib.map((entry, index) => ({ ...entry, color: chartColors[index] }));
  const payments = paymentDistrib.map((entry, index) => ({ ...entry, color: chartColors[index] }));
  const totalRevenue = monthlyData.reduce((s, d) => s + d.ingresos, 0);
  const totalAppts = monthlyData.reduce((s, d) => s + d.citas, 0);
  const avgPerAppt = Math.round(totalRevenue / totalAppts);
  const lastMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];
  const growth = Math.round(((lastMonth.ingresos - prevMonth.ingresos) / prevMonth.ingresos) * 100);

  return (
    <div className="space-y-6">
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
