import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, UserRound } from 'lucide-react';
import { APPOINTMENTS, MONTHS, WEEKDAYS } from '../../data';
import { AppointmentBadge } from '../../components/StatusBadge';
import type { BranchId } from '../../types';

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AdminCalendarPage({ branchId }: { branchId: BranchId }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(getDateKey(today));

  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const appointmentsByDate = APPOINTMENTS
    .filter(appointment => (appointment.branchId ?? 'main') === branchId)
    .reduce<Record<string, typeof APPOINTMENTS>>((accumulator, appointment) => {
    (accumulator[appointment.date] ??= []).push(appointment);
    return accumulator;
  }, {});
  const selectedAppts = (appointmentsByDate[selectedDate] ?? [])
    .slice()
    .sort((first, second) => first.time.localeCompare(second.time));
  const pendingCount = selectedAppts.filter(appointment => appointment.status === 'pending').length;

  function navPrev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function navNext() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function goToToday() {
    const todayKey = getDateKey(new Date());
    const [todayYear, todayMonth] = todayKey.split('-').map(Number);
    setYear(todayYear);
    setMonth(todayMonth - 1);
    setSelectedDate(todayKey);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-700 text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
          Calendario de citas
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Selecciona un día para consultar las citas y sus estados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] gap-5 items-start">
        <section className="card p-5 sm:p-6" aria-label="Calendario mensual de citas">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <button className="btn-ghost p-2" onClick={navPrev} aria-label="Mes anterior">
                <ChevronLeft size={18} />
              </button>
              <h3 className="min-w-36 text-center font-700 text-[var(--color-text)]">
                {MONTHS[month]} {year}
              </h3>
              <button className="btn-ghost p-2" onClick={navNext} aria-label="Mes siguiente">
                <ChevronRight size={18} />
              </button>
            </div>
            <button className="btn-secondary px-3 py-2 text-xs" onClick={goToToday}>Hoy</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-2 text-center text-[11px] font-600 text-[var(--color-text-muted)]">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, index) => (
              <div key={`empty-${index}`} className="h-11 sm:h-12" />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayAppointments = appointmentsByDate[dateKey] ?? [];
              const pendingForDay = dayAppointments.filter(appointment => appointment.status === 'pending').length;
              const hasAppointments = dayAppointments.length > 0;
              const selected = dateKey === selectedDate;
              const isToday = dateKey === getDateKey(new Date());
              return (
                <button
                  key={dateKey}
                  type="button"
                  aria-label={`${day} ${MONTHS[month]}${pendingForDay ? `, ${pendingForDay} citas sin confirmar` : ''}`}
                  aria-pressed={selected}
                  className={`calendar-day relative mx-auto ${selected ? 'selected' : ''} ${isToday && !selected ? 'today' : ''}`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  {day}
                  {hasAppointments && (
                    <span
                      className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${pendingForDay ? 'bg-amber-400' : selected ? 'bg-[#1A1316]' : 'bg-[var(--color-primary)]'}`}
                    />
                  )}
                  {pendingForDay > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[8px] font-700 text-white">
                      {pendingForDay > 9 ? '9+' : pendingForDay}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              Días con citas
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Citas sin confirmar
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded border border-[var(--color-primary)]" />
              Hoy
            </span>
          </div>
        </section>

        <section className="card p-5 sm:p-6" aria-live="polite">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] font-700 uppercase tracking-wider text-[var(--color-primary)]">Citas del día</div>
              <h3 className="mt-1 font-700 text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                {formatDisplayDate(selectedDate)}
              </h3>
            </div>
            {pendingCount > 0 && (
              <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-700 text-amber-300">
                {pendingCount} sin confirmar
              </span>
            )}
          </div>
          {selectedAppts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
              <CalendarDays size={28} className="mx-auto mb-2 opacity-60" />
              Sin citas para este día
            </div>
          ) : (
            <div className="space-y-3">
              {selectedAppts.map(appointment => (
                <article key={appointment.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[rgba(217,154,159,0.12)] text-[var(--color-primary)]">
                        <Clock size={14} />
                        <span className="mt-0.5 text-[10px] font-700">{appointment.time}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-700 text-[var(--color-text)]">{(appointment.services ?? [appointment.service]).map(service => service.name).join(' + ')}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                          <UserRound size={12} />
                          <span className="truncate">{appointment.clientName}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{appointment.duration ?? appointment.services?.reduce((sum, service) => sum + service.duration, 0) ?? appointment.service.duration} min · ${appointment.total}</div>
                      </div>
                    </div>
                    <AppointmentBadge status={appointment.status} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatDisplayDate(ds: string) {
  const [y, m, d] = ds.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const dow = WEEKDAYS[date.getDay()];
  return `${dow}, ${d} de ${MONTHS[parseInt(m) - 1]} ${y}`;
}
