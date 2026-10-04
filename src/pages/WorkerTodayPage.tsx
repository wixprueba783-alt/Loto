import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, User as UserIcon } from 'lucide-react';
import { APPOINTMENTS, MONTHS } from '../data';
import { AppointmentBadge } from '../components/StatusBadge';
import type { User } from '../types';

interface Props {
  user: User | null;
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day} de ${MONTHS[Number(month) - 1]} de ${year}`;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function WorkerTodayPage({ user }: Props) {
  const assignedAppointments = APPOINTMENTS.filter(appointment => appointment.workerUid === user?.uid);
  const initialDate = new Date();
  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState(dateKey(initialDate.getFullYear(), initialDate.getMonth(), initialDate.getDate()));
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const appointments = assignedAppointments
    .filter(appointment => appointment.date === selectedDate)
    .sort((first, second) => first.time.localeCompare(second.time));
  const appointmentDays = new Set(assignedAppointments.map(appointment => appointment.date));

  function moveMonth(direction: number) {
    const next = new Date(year, month + direction, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDate(dateKey(next.getFullYear(), next.getMonth(), 1));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Mi calendario de trabajo</h2>
        <p className="text-sm text-[#6B5A5E] mt-1">Selecciona un día para consultar tus citas asignadas</p>
      </div>

      <div className="card p-5 max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <button className="btn-ghost p-2" onClick={() => moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <div className="font-700 text-[#1A1012]">{MONTHS[month]} {year}</div>
          <button className="btn-ghost p-2" onClick={() => moveMonth(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="text-center text-xs font-600 text-[#BBA9AD] py-1">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }, (_, index) => <div key={`empty-${index}`} className="h-10" />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const value = dateKey(year, month, day);
            const selected = value === selectedDate;
            const hasAppointments = appointmentDays.has(value);
            return (
              <button key={value} className={`calendar-day relative mx-auto ${selected ? 'selected' : ''} ${hasAppointments && !selected ? 'today' : ''}`} onClick={() => setSelectedDate(value)}>
                {day}
                {hasAppointments && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${selected ? 'bg-[#1A1316]' : 'bg-[#D99A9F]'}`} />}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-[#6B5A5E]"><span className="w-2 h-2 rounded-full bg-[#C1536A]" /> Días con citas asignadas</div>
      </div>

      <div>
        <h3 className="font-700 text-[#1A1012] mb-3" style={{ fontFamily: 'var(--font-display)' }}>{formatDate(selectedDate)}</h3>
      </div>
      <div className="space-y-3">
        {appointments.map(appointment => (
          <div key={appointment.id} className="card p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#FFF1F3] flex items-center justify-center text-[#C1536A] font-700">
                {appointment.time}
              </div>
              <div className="min-w-0">
                <div className="font-700 text-[#1A1012] truncate">{(appointment.services ?? [appointment.service]).map(service => service.name).join(' + ')}</div>
                <div className="text-xs text-[#C1536A] mt-1">{formatDate(appointment.date)}</div>
                <div className="text-sm text-[#6B5A5E] flex items-center gap-1 mt-1">
                  <UserIcon size={13} /> {appointment.clientName}
                </div>
                <div className="text-xs text-[#BBA9AD] flex items-center gap-1 mt-1">
                  <Clock size={12} /> {appointment.duration ?? appointment.services?.reduce((sum, service) => sum + service.duration, 0) ?? appointment.service.duration} minutos
                </div>
              </div>
            </div>
            <AppointmentBadge status={appointment.status} />
          </div>
        ))}
      </div>

      {appointments.length === 0 && (
        <div className="card p-10 text-center text-[#BBA9AD]">
          <Calendar size={34} className="mx-auto mb-3 opacity-50" />
          <p className="font-500">No tienes citas asignadas para este día.</p>
        </div>
      )}
    </div>
  );
}
