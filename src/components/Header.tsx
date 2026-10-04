import { useState } from 'react';
import { Bell, LogOut, User, CalendarDays } from 'lucide-react';
import { APPOINTMENTS, MONTHS } from '../data';
import type { Role, Page } from '../types';

const pageTitles: Partial<Record<Page, string>> = {
  home: 'Inicio',
  catalog: 'Catálogo de Servicios',
  booking: 'Agendar Cita',
  'my-appointments': 'Mis Citas',
  'client-payments': 'Mis Pagos',
  profile: 'Mi Perfil',
  'worker-today': 'Mi trabajo de hoy',
  login: 'Iniciar Sesión',
  register: 'Crear Cuenta',
  'admin-dashboard': 'Panel',
  'admin-appointments': 'Gestión de Citas',
  'admin-calendar': 'Calendario',
  'admin-availability': 'Disponibilidad',
  'admin-catalog': 'Catálogo (Admin)',
  'admin-gallery': 'Galería',
  'admin-payments': 'Pagos',
  'admin-stats': 'Estadísticas',
  'admin-settings': 'Configuración',
};

interface HeaderProps {
  page: Page;
  role: Role;
  userName?: string;
  onLogout: () => void;
  onMobileMenu?: () => void;
}

export function Header({ page, role, userName, onLogout }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const visibleAppointments = role === 'worker'
    ? APPOINTMENTS.filter(appointment => appointment.status !== 'cancelled')
    : role === 'admin'
      ? APPOINTMENTS.filter(appointment => appointment.status === 'pending')
      : APPOINTMENTS.filter(appointment => appointment.status === 'pending');
  const pendingCount = visibleAppointments.length;

  function formatDate(date: string) {
    const [, month, day] = date.split('-');
    return `${day} ${MONTHS[Number(month) - 1].slice(0, 3)}`;
  }

  return (
    <header className="fixed top-0 right-0 left-0 h-16 bg-white border-b border-[#F5EDE6] z-40 flex items-center justify-between px-5 gap-4"
      style={{ boxShadow: '0 2px 8px rgba(200,100,120,0.06)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 md:hidden" />
        <div>
          <h1 className="text-base font-600 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>
            {pageTitles[page] || 'Loto'}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 relative">
        {(role === 'client' || role === 'admin' || role === 'worker') && (
          <>
            <div className="relative">
              <button className="btn-ghost p-2 relative" onClick={() => setNotificationsOpen(v => !v)} aria-label="Notificaciones">
                <Bell size={18} />
                {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E8778A] rounded-full" />}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 w-72 bg-white border border-[#F5EDE6] rounded-xl shadow-lg p-3 z-50">
                  <div className="text-xs font-700 text-[#6B5A5E] uppercase tracking-wide mb-2">Notificaciones</div>
                  {pendingCount > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <div className="text-xs text-[#6B5A5E] mb-2">
                        {role === 'worker' ? 'Citas asignadas' : 'Citas pendientes de confirmación'}
                      </div>
                      {visibleAppointments.slice(0, 8).map(appointment => (
                        <div key={appointment.id} className="flex items-start gap-2 rounded-lg bg-[#FFF1F3] p-2.5">
                          <CalendarDays size={14} className="mt-0.5 flex-shrink-0 text-[#C1536A]" />
                          <div className="min-w-0">
                            <div className="text-xs font-600 text-[#1A1012] truncate">{(appointment.services ?? [appointment.service]).map(service => service.name).join(' + ')}</div>
                            <div className="text-[11px] text-[#6B5A5E]">{formatDate(appointment.date)} · {appointment.time}</div>
                            {role === 'worker' && <div className="text-[11px] text-[#C1536A] truncate">{appointment.clientName}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[#6B5A5E]">No tienes notificaciones nuevas.</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-[#F5EDE6]">
              <div className="w-8 h-8 rounded-full bg-[#FECDD5] flex items-center justify-center text-[#C1536A] text-sm font-700">
                {userName?.charAt(0) || <User size={14} />}
              </div>
              <span className="text-sm font-500 text-[#3D2A2F] hidden sm:block">{userName}</span>
              <button className="btn-ghost p-1.5 text-[#BBA9AD] hover:text-red-400" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={15} />
              </button>
            </div>
          </>
        )}
        {role === 'guest' && (
          <span className="text-xs text-[#BBA9AD] font-500 hidden sm:block">Modo Invitado</span>
        )}
      </div>
    </header>
  );
}
