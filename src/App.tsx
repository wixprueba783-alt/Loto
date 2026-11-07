import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { GalleryPage } from './pages/GalleryPage';
import { BookingPage } from './pages/BookingPage';
import { MyAppointmentsPage } from './pages/MyAppointmentsPage';
import { ClientPaymentsPage } from './pages/ClientPaymentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { AdminAppointmentsPage } from './pages/admin/AppointmentsPage';
import { AdminCalendarPage } from './pages/admin/CalendarPage';
import { AdminAvailabilityPage } from './pages/admin/AvailabilityPage';
import { AdminCatalogPage } from './pages/admin/CatalogAdminPage';
import { SpecializedServicesPage } from './pages/admin/SpecializedServicesPage';
import { AdminGalleryPage } from './pages/admin/GalleryPage';
import { AdminPaymentsPage } from './pages/admin/AdminPaymentsPage';
import { AdminStatsPage } from './pages/admin/StatsPage';
import { AdminSettingsPage } from './pages/admin/SettingsPage';
import { WorkerTodayPage } from './pages/WorkerTodayPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { auth, loginWithFirebase, loginWithGoogle, logoutFromFirebase, registerWithFirebase, sendPasswordRecoveryEmail } from './firebase';
import { addAppointment, BRANCH_LABEL, BUSINESS_SETTINGS, currentPrivacyPolicyVersion, getUserProfile, initFirestoreData, saveUserProfile, subscribeFirestoreData } from './data';
import type { Role, Page, Service, User, BranchId } from './types';

const NO_LAYOUT_PAGES: Page[] = ['login', 'register'];

export default function App() {
  const requestedBranch = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('branch')
    : null;
  const qrBranch: BranchId | null = requestedBranch === 'main' || requestedBranch === 'north'
    ? requestedBranch
    : null;
  const savedBranch = typeof window !== 'undefined' ? window.localStorage.getItem('loto_branch_id') : null;
  const initialBranch: BranchId = qrBranch ?? (savedBranch === 'north' ? 'north' : 'main');
  const [role, setRole] = useState<Role>('guest');
  const [page, setPage] = useState<Page>(qrBranch ? 'booking' : 'home');
  const [user, setUser] = useState<User | null>(null);
  const [pendingGoogleRegistration, setPendingGoogleRegistration] = useState<{ uid: string; name: string; email: string } | null>(null);
  const [branchId, setBranchId] = useState<BranchId>(initialBranch);
  const [adminBranchId, setAdminBranchId] = useState<BranchId>(initialBranch);
  const [bookingService, setBookingService] = useState<Service | undefined>(undefined);
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState(false);
  const [firestoreErrorMessage, setFirestoreErrorMessage] = useState('');
  const [dataVersion, setDataVersion] = useState(0);
  const activeBranch = role === 'admin' ? adminBranchId : role === 'branchAdmin' ? user?.branchId ?? 'main' : branchId;
  const activeTheme = activeBranch === 'north' ? 'olive' : 'rose';
  const activeThemeColor = BUSINESS_SETTINGS.branchColors?.[activeBranch] || (activeBranch === 'north' ? '#BBC58E' : '#D99A9F');

  useEffect(() => {
    initFirestoreData()
      .then(() => {
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          return getUserProfile(auth.currentUser.uid).then(profile => {
            if (profile?.role) {
              setRole(profile.role);
              setUser(profile);
              setAdminBranchId(profile.role === 'branchAdmin' ? profile.branchId ?? 'main' : 'main');
              setBranchId(profile.role === 'branchAdmin' ? profile.branchId ?? 'main' : branchId);
              setPage(qrBranch ? 'booking' : profile.role === 'admin' || profile.role === 'branchAdmin' ? 'admin-dashboard' : profile.role === 'worker' ? 'worker-today' : 'home');
            }
          });
        }
        setRole('guest');
        setUser(null);
        setPage(qrBranch ? 'booking' : 'home');
      })
      .then(() => {
        setFirestoreLoading(false);
      })
      .catch(err => {
        console.error('Error cargando datos de Firestore:', err);
        setFirestoreError(true);
        setFirestoreErrorMessage(err instanceof Error ? err.message : 'Error desconocido de Firebase');
        setFirestoreLoading(false);
        // OJO: aquí NO ponemos setFirestoreLoading(false). Si Firebase no
        // está configurado, es mejor detener la app con un mensaje claro
        // que dejarla seguir con arreglos vacíos (lo que hacía que crear
        // servicios, citas, etc. pareciera fallar sin explicación).
      });
  }, []);

  useEffect(() => {
    if (firestoreLoading) return;
    let cancelled = false;
    const unsubscribe: { current: (() => void) | null } = { current: null };
    subscribeFirestoreData(() => setDataVersion(version => version + 1)).then(cleanup => {
      if (cancelled) cleanup();
      else unsubscribe.current = () => { cleanup(); };
    });
    return () => {
      cancelled = true;
      unsubscribe.current?.();
    };
  }, [role, firestoreLoading]);

  useEffect(() => {
    window.localStorage.removeItem('loto_session');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('loto_branch_id', branchId);
  }, [branchId]);

  function showNotification(msg: string, type: 'success' | 'error' | 'info' = 'success') {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }

  async function handleLogin(email: string, password: string) {
    try {
      const credentials = await loginWithFirebase(email, password);
      const profile = await getUserProfile(credentials.user.uid);
      if (!profile?.role) {
        await logoutFromFirebase();
        throw new Error('Tu cuenta no tiene un rol asignado. Contacta al administrador.');
      }
      setRole(profile.role);
      setUser({ ...profile, uid: credentials.user.uid });
      setAdminBranchId(profile.role === 'branchAdmin' ? profile.branchId ?? 'main' : 'main');
      setBranchId(profile.role === 'branchAdmin' ? profile.branchId ?? 'main' : branchId);
      setPage(profile.role === 'admin' || profile.role === 'branchAdmin' ? 'admin-dashboard' : profile.role === 'worker' ? 'worker-today' : 'home');
      showNotification('Sesión iniciada correctamente');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error('Correo o contraseña incorrectos.');
      }
      throw error;
    }
  }

  async function handleRegister(data: { name: string; email: string; phone: string; password: string; marketingConsent: boolean }) {
    const credentials = await registerWithFirebase(data.name, data.email, data.password);
    const acceptedAt = new Date().toISOString();
    const profile = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: 'client' as const,
      privacyConsent: { accepted: true, version: currentPrivacyPolicyVersion(), acceptedAt, source: 'registration' as const },
      marketingConsent: { accepted: data.marketingConsent, ...(data.marketingConsent ? { acceptedAt } : {}) },
    };
    await saveUserProfile(credentials.user.uid, profile);
    setRole('client');
    setUser({ ...profile, uid: credentials.user.uid });
    setPage('home');
    showNotification('¡Cuenta creada exitosamente!');
  }

  async function handleGoogleAuth(marketingConsent: boolean, allowRegistration = true, consentAccepted = false) {
    try {
      const credential = await loginWithGoogle();
      const existing = await getUserProfile(credential.user.uid);
      if (!existing && !allowRegistration) {
        await logoutFromFirebase();
        throw new Error('No encontramos una cuenta vinculada a Google. Regístrate primero desde “Regístrate”.');
      }
      if (!existing && !consentAccepted) {
        setPendingGoogleRegistration({
          uid: credential.user.uid,
          name: credential.user.displayName || credential.user.email || 'Cliente',
          email: credential.user.email || '',
        });
        setPage('register');
        return;
      }
      const acceptedAt = new Date().toISOString();
      const profile: User = existing
        ? { ...existing, uid: undefined }
        : {
            name: credential.user.displayName || credential.user.email || 'Cliente',
            email: credential.user.email || '',
            phone: '',
            role: 'client' as const,
            privacyConsent: { accepted: true, version: currentPrivacyPolicyVersion(), acceptedAt, source: 'google' as const },
            marketingConsent: { accepted: marketingConsent, ...(marketingConsent ? { acceptedAt } : {}) },
          };
      if (!existing) {
        const { uid: _uid, ...profileToSave } = profile;
        await saveUserProfile(credential.user.uid, profileToSave);
      }
      const role = profile.role || 'client';
      setRole(role);
      setUser({ ...profile, role, uid: credential.user.uid });
      setAdminBranchId(role === 'branchAdmin' ? profile.branchId ?? 'main' : 'main');
      setBranchId(role === 'branchAdmin' ? profile.branchId ?? 'main' : branchId);
      setPage(role === 'admin' || role === 'branchAdmin' ? 'admin-dashboard' : role === 'worker' ? 'worker-today' : 'home');
      showNotification(existing ? 'Sesión iniciada con Google.' : 'Cuenta de cliente creada con Google.');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/account-exists-with-different-credential') {
        throw new Error('Ya existe una cuenta con ese correo. Inicia sesión con correo y contraseña y vincula Google desde tu perfil.');
      }
      if (code === 'auth/operation-not-allowed') {
        throw new Error('El inicio con Google no está habilitado en Firebase. El administrador debe activarlo en Authentication → Método de acceso → Google y guardar los cambios.');
      }
      throw error;
    }
  }

  async function completeGoogleRegistration(marketingConsent: boolean) {
    const currentUser = auth.currentUser;
    if (!pendingGoogleRegistration || currentUser?.uid !== pendingGoogleRegistration.uid) {
      throw new Error('Tu sesión de Google expiró. Vuelve a continuar con Google para registrarte.');
    }

    const acceptedAt = new Date().toISOString();
    const profile: User = {
      name: pendingGoogleRegistration.name,
      email: pendingGoogleRegistration.email,
      phone: '',
      role: 'client',
      privacyConsent: { accepted: true, version: currentPrivacyPolicyVersion(), acceptedAt, source: 'google' },
      marketingConsent: { accepted: marketingConsent, ...(marketingConsent ? { acceptedAt } : {}) },
    };
    await saveUserProfile(pendingGoogleRegistration.uid, profile);
    setRole('client');
    setUser({ ...profile, uid: pendingGoogleRegistration.uid });
    setPendingGoogleRegistration(null);
    setPage('home');
    showNotification('Cuenta de cliente creada con Google.');
  }

  async function cancelGoogleRegistration() {
    await logoutFromFirebase();
    setPendingGoogleRegistration(null);
    setPage('login');
  }

  async function handleLogout() {
    await logoutFromFirebase();
    setRole('guest');
    setUser(null);
    setPage('home');
    showNotification('Sesión cerrada', 'info');
  }

  async function handleBookingConfirm(appt: any, selectedBranch: BranchId) {
    try {
      const normalizedPhone = appt.contact.phone;
      if (role === 'client' && user?.uid && user.phone !== normalizedPhone) {
        const { uid: _uid, ...profile } = user;
        const updatedProfile = { ...profile, phone: normalizedPhone };
        await saveUserProfile(user.uid, updatedProfile);
        setUser({ ...updatedProfile, uid: user.uid });
      }
      await addAppointment({
      id: `a${Date.now()}`,
      clientName: appt.contact.name,
      clientEmail: appt.contact.email,
      clientPhone: appt.contact.phone,
      service: appt.service,
      services: appt.services,
      duration: appt.duration,
      date: appt.date,
      time: appt.time,
      status: BUSINESS_SETTINGS.autoConfirm ? 'confirmed' : 'pending',
      payments: appt.payments,
      total: appt.total,
      subservices: appt.subservices,
      privacyConsent: appt.privacyConsent,
      marketingConsent: appt.marketingConsent,
      createdAt: new Date().toISOString().slice(0, 10),
      ownerUid: auth.currentUser?.uid,
      branchId: selectedBranch,
    }, selectedBranch);
      showNotification('¡Cita agendada exitosamente!');
    } catch (error) {
      const permissionDenied = typeof error === 'object' && error !== null && 'code' in error && error.code === 'permission-denied';
      if (permissionDenied) console.error('Firebase denegó guardar la cita o reservar su horario:', error);
      const message = permissionDenied
          ? 'Firebase denegó la reserva. Las reglas actualizadas ya están publicadas en loto-19em; recarga la app. Si continúa, confirma que esté conectada a ese proyecto.'
        : error instanceof Error ? error.message : 'No se pudo guardar la cita.';
      showNotification(`No se pudo guardar la cita: ${message}`, 'error');
      throw new Error(message);
    }
  }

  const noLayout = NO_LAYOUT_PAGES.includes(page);

  if (firestoreLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6"
        style={{ background: 'var(--color-bg)' }}>
        {!firestoreError && (
          <>
            <div className="w-10 h-10 rounded-full border-4 border-[#FECDD5] border-t-[#E8778A] animate-spin" />
            <p className="text-sm text-[var(--color-text-muted)]">Cargando la aplicación...</p>
          </>
        )}
        {firestoreError && (
          <div className="card max-w-sm text-center p-5">
            <p className="text-sm font-700 text-[var(--color-danger)] mb-2">No se pudo conectar a Firebase</p>
            {firestoreErrorMessage.includes('serviceSubservices') ? (
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Publica en Firebase las reglas de lectura y escritura de la colección <code className="bg-[#222024] px-1 rounded">serviceSubservices</code>.
              </p>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-2">
                Revisa el archivo <code className="bg-[#222024] px-1 rounded">.env</code> y confirma que las reglas de Firestore estén publicadas.
              </p>
            )}
            {firestoreErrorMessage && <p className="text-xs text-red-500 leading-relaxed mt-2">{firestoreErrorMessage}</p>}
          </div>
        )}
      </div>
    );
  }

  if (noLayout) {
    return (
      <div data-branch-theme={activeTheme} data-branch-id={branchId} style={{ '--color-primary': activeThemeColor } as React.CSSProperties}>
        {page === 'login' && <LoginPage setPage={setPage} onLogin={handleLogin} onGoogle={() => handleGoogleAuth(false, true)} onPasswordRecovery={sendPasswordRecoveryEmail} />}
        {page === 'register' && <RegisterPage
          setPage={setPage}
          onRegister={handleRegister}
          onGoogle={(marketingConsent) => handleGoogleAuth(marketingConsent, true, true)}
          googleRegistration={pendingGoogleRegistration ? { name: pendingGoogleRegistration.name, email: pendingGoogleRegistration.email } : undefined}
          onCompleteGoogleRegistration={completeGoogleRegistration}
          onCancelGoogleRegistration={cancelGoogleRegistration}
        />}
        {notification && <Notification msg={notification.msg} type={notification.type} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-page={page} data-branch-theme={activeTheme} data-branch-id={activeBranch} style={{ background: 'var(--color-bg)', '--color-primary': activeThemeColor } as React.CSSProperties}>
      {/* Sidebar */}
      <Sidebar role={role} page={page} setPage={setPage} userName={user?.name} />

      {/* Main content area */}
      <div className="transition-all duration-200"
        style={{ paddingTop: page === 'home' ? 0 : 64 }}
        id="main-content">
        {page !== 'home' && <Header page={page} role={role} userName={user?.name} onLogout={handleLogout} />}

        <main className={page === 'home' ? 'max-w-none p-0' : 'max-w-[1400px] p-5 sm:p-6 lg:p-7'}>
          {(role === 'admin' || role === 'branchAdmin') && page.startsWith('admin-') && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div>
                <div className="text-xs font-700 text-[var(--color-text)]">Vista de sucursal</div>
                <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{role === 'admin' ? 'Consulta las citas, pagos y disponibilidad de cada sucursal por separado.' : `Acceso limitado a ${BRANCH_LABEL[user?.branchId ?? 'main']}.`}</div>
              </div>
              {role === 'admin' && <div className="flex gap-2" role="group" aria-label="Seleccionar sucursal para administración">
                {([
                  { id: 'main' as const, label: BRANCH_LABEL.main },
                  { id: 'north' as const, label: BRANCH_LABEL.north },
                ]).map(branch => (
                  <button
                    key={branch.id}
                    type="button"
                    aria-pressed={adminBranchId === branch.id}
                    onClick={() => setAdminBranchId(branch.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-600 transition ${adminBranchId === branch.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[#1A1316]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'}`}
                  >
                    {branch.label}
                  </button>
                ))}
              </div>}
            </div>
          )}
          <PageContent
            key={`${page}-${adminBranchId}`}
            page={page}
            role={role}
            user={user}
            setPage={setPage}
            branchId={branchId}
            adminBranchId={adminBranchId}
            onSelectBranch={setBranchId}
            bookingService={bookingService}
            setBookingService={setBookingService}
            onBookingConfirm={handleBookingConfirm}
            onUpdateUser={setUser}
            isGoogleRegistrationPending={pendingGoogleRegistration !== null}
          />
        </main>
      </div>

      {notification && <Notification msg={notification.msg} type={notification.type} />}
    </div>
  );
}

interface PageContentProps {
  page: Page;
  role: Role;
  user: User | null;
  setPage: (p: Page) => void;
  branchId: BranchId;
  adminBranchId: BranchId;
  onSelectBranch: (branchId: BranchId) => void;
  bookingService: Service | undefined;
  setBookingService: (s: Service | undefined) => void;
  onBookingConfirm: (appt: any, branchId: BranchId) => Promise<void>;
  onUpdateUser: (u: User) => void;
  isGoogleRegistrationPending: boolean;
}

function PageContent({ page, role, user, setPage, branchId, adminBranchId, onSelectBranch, bookingService, setBookingService, onBookingConfirm, onUpdateUser, isGoogleRegistrationPending }: PageContentProps) {
  const adminPages: Page[] = ['admin-dashboard', 'admin-appointments', 'admin-calendar', 'admin-availability', 'admin-catalog', 'admin-specialized', 'admin-gallery', 'admin-payments', 'admin-stats', 'admin-settings'];
  const branchAdminPages: Page[] = ['admin-dashboard', 'admin-appointments', 'admin-calendar', 'admin-availability', 'admin-payments', 'admin-stats'];
  if (adminPages.includes(page) && role !== 'admin' && !(role === 'branchAdmin' && branchAdminPages.includes(page))) return <AccessDenied />;
  if (page === 'worker-today' && role !== 'worker') return <AccessDenied />;

  switch (page) {
    case 'home':
      return <HomePage setPage={setPage} role={role} setBookingService={setBookingService} branchId={branchId} onSelectBranch={onSelectBranch} />;
      case 'catalog':
        return <CatalogPage setPage={setPage} setBookingService={setBookingService} />;
      case 'gallery':
        return <GalleryPage setPage={setPage} />;
    case 'booking':
      return (
        <BookingPage
          setPage={setPage}
          role={role}
          user={user}
          initialService={bookingService}
          branchId={branchId}
          onConfirm={appt => onBookingConfirm(appt, branchId)}
        />
      );
    case 'my-appointments':
      return <MyAppointmentsPage user={user} branchId={branchId} onReschedule={service => { setBookingService(service); setPage('booking'); }} />;
    case 'client-payments':
      return <ClientPaymentsPage user={user} branchId={branchId} />;
    case 'profile':
      return user ? <ProfilePage user={user} branchId={branchId} onUpdate={onUpdateUser} /> : null;
    case 'worker-today':
      return <WorkerTodayPage user={user} />;

    // Admin pages
    case 'admin-dashboard':
      return <DashboardPage branchId={adminBranchId} />;
    case 'admin-appointments':
      return <AdminAppointmentsPage branchId={adminBranchId} />;
    case 'admin-calendar':
      return <AdminCalendarPage branchId={adminBranchId} />;
    case 'admin-availability':
      return <AdminAvailabilityPage branchId={adminBranchId} />;
    case 'admin-catalog':
      return <AdminCatalogPage />;
    case 'admin-specialized':
      return <SpecializedServicesPage />;
    case 'admin-gallery':
      return <AdminGalleryPage />;
    case 'admin-payments':
      return <AdminPaymentsPage branchId={adminBranchId} />;
    case 'admin-stats':
      return <AdminStatsPage branchId={adminBranchId} />;
    case 'admin-settings':
      return <AdminSettingsPage branchId={adminBranchId} />;
    case 'privacy':
      return <PrivacyPolicyPage
        setPage={nextPage => setPage(isGoogleRegistrationPending && nextPage === 'home' ? 'register' : nextPage)}
        role={role}
      />;

    default:
      return (
        <div className="text-center py-20 text-[#BBA9AD]">
          <p className="text-lg font-500">Página no encontrada</p>
        </div>
      );
  }
}

function AccessDenied() {
  return <div className="card p-10 text-center text-[#6B5A5E]">No tienes permisos para ver esta sección.</div>;
}

function Notification({ msg, type }: { msg: string; type: 'success' | 'error' | 'info' }) {
  const colors = {
    success: 'border-l-4 border-emerald-400',
    error: 'border-l-4 border-red-400',
    info: 'border-l-4 border-blue-400',
  };
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const iconColors = { success: 'text-[var(--color-success)]', error: 'text-[var(--color-danger)]', info: 'text-[var(--color-info)]' };

  return (
    <div className={`notification ${colors[type]}`}>
      <span className={`text-base font-700 ${iconColors[type]}`}>{icons[type]}</span>
      <span className="text-[var(--color-text)]">{msg}</span>
    </div>
  );
}
