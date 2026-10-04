import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Filter } from 'lucide-react';
import { APPOINTMENTS, MONTHS } from '../data';
import { AppointmentBadge } from '../components/StatusBadge';
import type { AppointmentStatus, User, BranchId } from '../types';

interface Props {
  user: User | null;
  branchId: BranchId;
  onReschedule?: (service: import('../types').Service) => void;
}

const STATUS_FILTERS: { label: string; value: AppointmentStatus | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Confirmadas', value: 'confirmed' },
  { label: 'Completadas', value: 'completed' },
];

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

const methodLabel: Record<string, string> = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta' };

export function MyAppointmentsPage({ user, branchId, onReschedule }: Props) {
  const [filter, setFilter] = useState<AppointmentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = APPOINTMENTS.filter(a =>
    (a.branchId ?? 'main') === branchId &&
    a.status !== 'cancelled' && (filter === 'all' || a.status === filter) && (user?.uid ? a.ownerUid === user.uid : a.clientEmail === user?.email)
  ).sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`));
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleAppointments = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-[#BBA9AD]" />
        {STATUS_FILTERS.map(f => (
          <button key={f.value}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-600 transition-all border ${filter === f.value
              ? 'bg-[#E8778A] text-white border-[#E8778A]'
              : 'bg-white text-[#6B5A5E] border-[#EDD9CC] hover:border-[#E8778A]'}`}
            onClick={() => { setFilter(f.value); setPage(1); }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Appointment cards */}
      <div className="space-y-4">
        {visibleAppointments.map(appt => (
          <div key={appt.id} className="card p-5 sm:p-6 transition-shadow hover:shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-5 md:gap-8 items-center">
              <div className="flex gap-4 min-w-0">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F5EDE6] flex-shrink-0">
                  <img src={appt.service.image} alt={appt.service.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  {appt.serviceType && (
                    <div className="mb-1 text-[10px] font-700 uppercase tracking-wide text-[var(--color-primary)]">
                      {appt.serviceType === 'manicure' ? 'Manicure · manos' : 'Pedicure · pies'}
                    </div>
                  )}
                  <h3 className="font-700 text-[#1A1012] text-lg truncate">{(appt.services ?? [appt.service]).map(service => service.name).join(' + ')}</h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6B5A5E] mt-2">
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-[#C1536A]" />{formatDate(appt.date)}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-[#C1536A]" />{appt.time}</span>
                    <span className="text-xs text-[#8D7A7D]">{appt.duration ?? appt.services?.reduce((sum, service) => sum + service.duration, 0) ?? appt.service.duration} min</span>
                  </div>
                  <div className="text-xs text-[#9B898B] mt-2">Método: {appt.payments.length > 0 ? appt.payments.map(p => methodLabel[p.method]).join(' + ') : 'Sin pago registrado'}</div>
                  {(appt.subservices ?? []).length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2">
                      {appt.subservices?.map(subservice => (
                        <div key={subservice.id} className="flex justify-between gap-3 text-xs text-[var(--color-text-muted)]">
                          <span>{subservice.name} · {subservice.quantity} {subservice.quantity === 1 ? 'uña' : 'uñas'} × ${subservice.pricePerNail.toFixed(2)}</span>
                          <strong className="text-[var(--color-text)]">${(subservice.quantity * subservice.pricePerNail).toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="md:border-l md:border-[#F0E5E0] md:pl-6 flex md:flex-col items-center md:items-end justify-between gap-3">
                <div className="text-right">
                  <div className="text-xs text-[#9B898B] uppercase tracking-wide">Total</div>
                  <div className="text-2xl font-700 text-[#C1536A]">${appt.total}</div>
                </div>
                <AppointmentBadge status={appt.status} />
              </div>
            </div>
            {onReschedule && <button className="btn-secondary mt-5" onClick={() => onReschedule(appt.service)}>Agendar otra cita</button>}
          </div>
        ))}
      </div>

      {filtered.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-[#F0E5E0] bg-white px-4 py-3">
          <span className="text-xs text-[#8D7A7D]">Página {page} de {pageCount}</span>
          <div className="flex gap-1">
            <button className="btn-ghost p-2" disabled={page === 1} onClick={() => setPage(current => current - 1)}><ChevronLeft size={15} /></button>
            <button className="btn-ghost p-2" disabled={page === pageCount} onClick={() => setPage(current => current + 1)}><ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[#BBA9AD]">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-500">No tienes citas {filter !== 'all' ? `${filter}s` : ''}</p>
        </div>
      )}
    </div>
  );
}
