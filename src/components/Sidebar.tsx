import { useState } from 'react';
import {
  Home, BookOpen, Calendar, CreditCard, User, LayoutDashboard,
  CalendarDays, Clock, Package, ImageIcon, BarChart2, Settings,
  ChevronLeft, ChevronRight, Sparkles, X, LogIn, Menu, WandSparkles
} from 'lucide-react';
import type { Role, Page } from '../types';

interface NavItem { icon: React.ReactNode; label: string; page: Page; }

const guestNav: NavItem[] = [
  { icon: <Home size={18} />, label: 'Inicio', page: 'home' },
  { icon: <BookOpen size={18} />, label: 'Catálogo', page: 'catalog' },
  { icon: <Calendar size={18} />, label: 'Agendar cita', page: 'booking' },
  { icon: <LogIn size={18} />, label: 'Iniciar sesión', page: 'login' },
];

const clientNav: NavItem[] = [
  { icon: <Home size={18} />, label: 'Inicio', page: 'home' },
  { icon: <BookOpen size={18} />, label: 'Catálogo', page: 'catalog' },
  { icon: <Calendar size={18} />, label: 'Agendar cita', page: 'booking' },
  { icon: <CalendarDays size={18} />, label: 'Mis citas', page: 'my-appointments' },
  { icon: <CreditCard size={18} />, label: 'Pagos', page: 'client-payments' },
  { icon: <User size={18} />, label: 'Perfil', page: 'profile' },
];

const adminNav: NavItem[] = [
  { icon: <LayoutDashboard size={18} />, label: 'Panel', page: 'admin-dashboard' },
  { icon: <CalendarDays size={18} />, label: 'Citas', page: 'admin-appointments' },
  { icon: <Calendar size={18} />, label: 'Calendario', page: 'admin-calendar' },
  { icon: <Clock size={18} />, label: 'Disponibilidad', page: 'admin-availability' },
  { icon: <Package size={18} />, label: 'Catálogo', page: 'admin-catalog' },
  { icon: <WandSparkles size={18} />, label: 'Servicios especializados', page: 'admin-specialized' },
  { icon: <ImageIcon size={18} />, label: 'Galería', page: 'admin-gallery' },
  { icon: <CreditCard size={18} />, label: 'Pagos', page: 'admin-payments' },
  { icon: <BarChart2 size={18} />, label: 'Estadísticas', page: 'admin-stats' },
  { icon: <Settings size={18} />, label: 'Configuración', page: 'admin-settings' },
];

const workerNav: NavItem[] = [
  { icon: <CalendarDays size={18} />, label: 'Mi trabajo de hoy', page: 'worker-today' },
];

function navByRole(role: Role): NavItem[] {
  if (role === 'admin') return adminNav;
  if (role === 'client') return clientNav;
  if (role === 'worker') return workerNav;
  return guestNav;
}

interface SidebarProps {
  role: Role;
  page: Page;
  setPage: (p: Page) => void;
  userName?: string;
}

export function Sidebar({ role, page, setPage, userName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navByRole(role);
  const desktopWidth = collapsed ? 64 : 240;

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className="flex flex-col h-full"
      style={{
        width: mobile ? 260 : desktopWidth,
        transition: 'width 0.2s ease',
      }}
    >
      <div className="flex items-center justify-between p-4 border-b border-[#F5EDE6]" style={{ minHeight: 64 }}>
        {(!collapsed || mobile) && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-primary)' }}>
              <Sparkles size={16} color="#1A1316" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-700 text-[#1A1012] truncate" style={{ fontFamily: 'var(--font-display)' }}>
                Loto
              </div>
              <div className="text-[10px] text-[#BBA9AD] font-500 leading-tight">
                {role === 'admin' ? 'Administrador' : role === 'client' ? 'Cliente' : role === 'worker' ? 'Trabajadora' : 'Invitado'}
              </div>
            </div>
          </div>
        )}
        {collapsed && !mobile && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
            style={{ background: 'var(--color-primary)' }}>
            <Sparkles size={16} color="#1A1316" />
          </div>
        )}
        {mobile && (
          <button className="btn-ghost p-1" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.page}
            className={`sidebar-nav-item w-full ${page === item.page ? 'active' : ''} ${collapsed && !mobile ? 'justify-center px-0' : ''}`}
            onClick={() => { setPage(item.page); if (mobile) setMobileOpen(false); }}
            title={collapsed && !mobile ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {(!collapsed || mobile) && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {(!collapsed || mobile) && userName && (
        <div className="p-3 border-t border-[#F5EDE6]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#FFF1F3]">
            <div className="w-7 h-7 rounded-full bg-[#FECDD5] flex items-center justify-center text-[#C1536A] text-xs font-700">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-600 text-[#3D2A2F] truncate">{userName}</div>
            </div>
          </div>
        </div>
      )}

      {!mobile && (
        <button
          className="flex items-center justify-center p-3 border-t border-[#F5EDE6] text-[#BBA9AD] hover:text-[#E8778A] transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="sidebar-desktop fixed left-0 top-0 h-screen bg-[#0B0A0B] border-r border-[#F5EDE6] z-50 flex flex-col"
        style={{ width: desktopWidth, transition: 'width 0.2s ease', boxShadow: '2px 0 8px rgba(200,100,120,0.06)' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile hamburger button */}
      <button
        className="sidebar-mobile-trigger fixed top-4 left-4 z-50 p-2.5 rounded-xl shadow-md border border-[#F5EDE6] md:hidden"
        id="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-[#E8778A]" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" style={{ display: 'flex' }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="sidebar-mobile-panel relative h-full overflow-y-auto" style={{ width: 260 }}>
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Mobile trigger helper - always visible on small screens */}
    </>
  );
}

export function useSidebarWidth(): number {
  const [collapsed] = useState(false);
  return collapsed ? 64 : 240;
}
