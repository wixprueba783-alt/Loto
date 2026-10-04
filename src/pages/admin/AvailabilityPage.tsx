import { useState } from 'react';
import { CalendarDays, Clock, Save } from 'lucide-react';
import { getAvailability, getBookedTimes, saveAvailability } from '../../data';
import type { BranchId } from '../../types';

export function AdminAvailabilityPage({ branchId }: { branchId: BranchId }) {
  const today = new Date();
  const initialDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [schedule, setSchedule] = useState(() => getAvailability(initialDate, branchId));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  function changeDate(date: string) {
    setSelectedDate(date);
    setSchedule(getAvailability(date, branchId));
    setSaved(false);
  }

  function updateSchedule(changes: Partial<typeof schedule>) {
    setSaved(false);
    setSchedule(current => ({ ...current, ...changes }));
  }

  async function saveSchedule() {
    setSaved(false);
    setSaveError('');
    try {
      await saveAvailability(schedule, branchId);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los horarios.');
    }
  }

  const bookedTimes = getBookedTimes(selectedDate, branchId);
  const openHour = Number(schedule.open.slice(0, 2));
  const closeHour = Number(schedule.close.slice(0, 2));
  const timeSlots = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, index) => `${String(openHour + index).padStart(2, '0')}:00`);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="card p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] text-[#E8778A] flex items-center justify-center shrink-0">
            <CalendarDays size={20} />
          </div>
          <div>
            <h2 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>
              Disponibilidad por fecha
            </h2>
            <p className="text-sm text-[#6B5A5E] mt-1">
              Elige un día exacto y configura sus horas disponibles.
            </p>
          </div>
        </div>

        <div className="mb-5 max-w-sm">
          <div className="mb-1.5 text-xs font-600 text-[#3D2A2F]">Sucursal</div>
          <div className="text-sm font-600 text-[#C1536A]">{branchId === 'north' ? 'Sucursal Norte' : 'Sucursal principal'}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="sm:col-span-1">
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Fecha exacta</label>
            <input className="input-field text-sm" type="date" value={selectedDate} onChange={event => changeDate(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm font-600 text-[#3D2A2F] sm:pt-7">
            <input type="checkbox" checked={schedule.enabled} onChange={event => updateSchedule({ enabled: event.target.checked })} className="accent-[#E8778A]" />
            Día disponible
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Desde</label>
            <input className="input-field text-sm" type="time" value={schedule.open} disabled={!schedule.enabled} onChange={event => updateSchedule({ open: event.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Hasta</label>
            <input className="input-field text-sm" type="time" value={schedule.close} disabled={!schedule.enabled} onChange={event => updateSchedule({ close: event.target.value })} />
          </div>
        </div>

        <div className="mt-7 pt-5 border-t border-[#F5EDE6]">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-[#E8778A]" />
            <h3 className="text-sm font-700 text-[#1A1012]">Bloques del día</h3>
          </div>
          {!schedule.enabled ? (
            <p className="text-sm text-[#BBA9AD]">Domingo bajo disposición.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {timeSlots.map(time => (
                <div key={time} className={`rounded-lg border px-3 py-2 text-center text-xs font-600 ${bookedTimes.has(time) ? 'border-[#FECDD5] bg-[#FFF1F3] text-[#C1536A]' : 'border-[#F5EDE6] bg-[#FDFAF9] text-[#6B5A5E]'}`}>
                  {time}<span className="block text-[10px] font-500 mt-0.5">{bookedTimes.has(time) ? 'Ocupado' : 'Libre'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={saveSchedule}>
          <Save size={16} /> Guardar horarios
        </button>
        {saved && <span className="text-sm text-emerald-600">Horarios guardados</span>}
        {saveError && <span className="text-sm text-red-500">{saveError}</span>}
      </div>
    </div>
  );
}
