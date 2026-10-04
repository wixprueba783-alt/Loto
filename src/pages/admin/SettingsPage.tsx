import { useState, useEffect, type ReactNode } from 'react';
import { Edit2, Save, Trash2 } from 'lucide-react';
import { BUSINESS_SETTINGS, deleteManagedUser, getUsers, saveBusinessSettings, saveUserProfile, updateManagedUser } from '../../data';
import { createManagedAccount } from '../../firebase';
import type { BranchBusinessSettings, Role, User } from '../../types';

type Settings = typeof BUSINESS_SETTINGS;
type SecondarySettings = BranchBusinessSettings;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="font-700 text-[#1A1012] mb-5 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field<T extends object>({ settings, onChange, label, k, type = 'text', placeholder }: {
  settings: T;
  onChange: (key: string, value: string | boolean) => void;
  label: string;
  k: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">{label}</label>
      <input className="input-field text-sm" type={type} placeholder={placeholder}
        value={String(settings[k as keyof T] ?? '')}
        onChange={e => onChange(k, e.target.value)} />
    </div>
  );
}

function Toggle({ settings, onChange, label, k, description }: {
  settings: Settings;
  onChange: (key: string, value: string | boolean) => void;
  label: string;
  k: string;
  description?: string;
}) {
  const enabled = Boolean(settings[k as keyof Settings]);
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-500 text-[#1A1012]">{label}</div>
        {description && <div className="text-xs text-[#BBA9AD] mt-0.5">{description}</div>}
      </div>
      <button type="button" aria-pressed={enabled}
        className={`toggle-track ${enabled ? 'is-on bg-[#E8778A]' : 'bg-[#EDD9CC]'}`}
        onClick={() => onChange(k, !enabled)}>
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState(BUSINESS_SETTINGS);
  const [secondarySettings, setSecondarySettings] = useState<SecondarySettings>(BUSINESS_SETTINGS.secondaryBranch!);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [account, setAccount] = useState({ name: '', email: '', phone: '', password: '', role: 'worker' as Exclude<Role, 'guest' | 'client'> });
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setSettings(BUSINESS_SETTINGS);
    setSecondarySettings(BUSINESS_SETTINGS.secondaryBranch ?? {
      businessName: '',
      tagline: '',
      phone: '',
      email: '',
      address: '',
      instagram: '',
      facebook: '',
      whatsapp: '',
      latitude: '',
      longitude: '',
    });
  }, [BUSINESS_SETTINGS.businessName, BUSINESS_SETTINGS.tagline, BUSINESS_SETTINGS.phone, BUSINESS_SETTINGS.email, BUSINESS_SETTINGS.address, BUSINESS_SETTINGS.instagram, BUSINESS_SETTINGS.facebook, BUSINESS_SETTINGS.whatsapp, BUSINESS_SETTINGS.latitude, BUSINESS_SETTINGS.longitude, BUSINESS_SETTINGS.autoConfirm, BUSINESS_SETTINGS.reminderEmail, BUSINESS_SETTINGS.reminderHours, BUSINESS_SETTINGS.maxDailyAppts, BUSINESS_SETTINGS.appointmentDuration, JSON.stringify(BUSINESS_SETTINGS.categories), BUSINESS_SETTINGS.secondaryBranch?.businessName, BUSINESS_SETTINGS.secondaryBranch?.tagline, BUSINESS_SETTINGS.secondaryBranch?.phone, BUSINESS_SETTINGS.secondaryBranch?.email, BUSINESS_SETTINGS.secondaryBranch?.address, BUSINESS_SETTINGS.secondaryBranch?.instagram, BUSINESS_SETTINGS.secondaryBranch?.facebook, BUSINESS_SETTINGS.secondaryBranch?.whatsapp, BUSINESS_SETTINGS.secondaryBranch?.latitude, BUSINESS_SETTINGS.secondaryBranch?.longitude]);

  function handleChange(k: string, v: string | boolean) {
    setSettings(prev => ({ ...prev, [k]: v }));
  }

  function handleSecondaryChange(k: string, v: string | boolean) {
    setSecondarySettings(previous => ({ ...previous, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      await saveBusinessSettings({ ...settings, secondaryBranch: secondarySettings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  async function findAddressFromCoordinates() {
    const latitude = Number(settings.latitude);
    const longitude = Number(settings.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setAccountError('Escribe una latitud y longitud válidas.');
      return;
    }
    setLocating(true);
    setAccountError('');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=es`);
      if (!response.ok) throw new Error('No se pudo consultar la dirección.');
      const result = await response.json() as { display_name?: string };
      if (!result.display_name) throw new Error('No se encontró una dirección para esas coordenadas.');
      setSettings(current => ({ ...current, address: result.display_name || current.address }));
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'No se pudo obtener la dirección.');
    } finally {
      setLocating(false);
    }
  }

  async function createAccount() {
    setAccountError('');
    setAccountMessage('');
    if (!account.name.trim() || !account.email.trim() || account.password.length < 6) {
      setAccountError('Completa nombre, correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    try {
      const uid = await createManagedAccount(account.email.trim(), account.password);
      await saveUserProfile(uid, {
        name: account.name.trim(),
        email: account.email.trim(),
        phone: account.phone.trim(),
        role: account.role,
      });
      setUsers(current => [...current, { uid, name: account.name, email: account.email, phone: account.phone, role: account.role }]);
      setAccount({ name: '', email: '', phone: '', password: '', role: 'worker' });
      setAccountMessage('Cuenta creada correctamente.');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
    }
  }

  function editAccount(item: User) {
    setEditingUid(item.uid || null);
    setAccount({ name: item.name, email: item.email, phone: item.phone, password: '', role: item.role === 'admin' ? 'admin' : 'worker' });
    setAccountError('');
    setAccountMessage('');
  }

  async function saveAccount() {
    if (!editingUid) return;
    setAccountError('');
    try {
      await updateManagedUser(editingUid, { name: account.name.trim(), email: account.email.trim(), phone: account.phone.trim(), role: account.role });
      setUsers(current => current.map(item => item.uid === editingUid ? { ...item, name: account.name.trim(), email: account.email.trim(), phone: account.phone.trim(), role: account.role } : item));
      setEditingUid(null);
      setAccountMessage('Cuenta actualizada.');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'No se pudo actualizar la cuenta.');
    }
  }

  async function removeAccount(item: User) {
    if (!item.uid || !window.confirm(`¿Eliminar el perfil de ${item.name}?`)) return;
    try {
      await deleteManagedUser(item.uid);
      setUsers(current => current.filter(user => user.uid !== item.uid));
      setAccountMessage('Perfil eliminado. La cuenta de Authentication debe eliminarse desde Firebase Console o una Cloud Function.');
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'No se pudo eliminar el perfil.');
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="Información del negocio">
        <Field settings={settings} onChange={handleChange} label="Nombre del negocio" k="businessName" placeholder="Estudio de uñas" />
        <Field settings={settings} onChange={handleChange} label="Slogan" k="tagline" placeholder="Tu belleza, nuestra pasión" />
        <Field settings={settings} onChange={handleChange} label="Teléfono / WhatsApp" k="phone" placeholder="555-100-2000" />
        <Field settings={settings} onChange={handleChange} label="Correo electrónico" k="email" type="email" placeholder="admin@nailstudio.mx" />
        <Field settings={settings} onChange={handleChange} label="Dirección" k="address" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field settings={settings} onChange={handleChange} label="Latitud" k="latitude" placeholder="19.4326" />
          <Field settings={settings} onChange={handleChange} label="Longitud" k="longitude" placeholder="-99.1332" />
        </div>
        <button type="button" className="btn-secondary" onClick={findAddressFromCoordinates} disabled={locating}>
          {locating ? 'Buscando dirección...' : 'Obtener dirección desde coordenadas'}
        </button>
        <Field settings={settings} onChange={handleChange} label="Instagram" k="instagram" placeholder="@nailstudio.mx" />
        <Field settings={settings} onChange={handleChange} label="Facebook" k="facebook" placeholder="facebook.com/nailstudio" />
        <Field settings={settings} onChange={handleChange} label="WhatsApp" k="whatsapp" placeholder="5551002000" />
      </Section>

      <Section title="Sucursal Norte">
        <p className="text-sm text-[#6B5A5E]">
          Información independiente que verán los clientes cuando elijan la sucursal norte. El catálogo de servicios se comparte entre sucursales.
        </p>
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Nombre del negocio" k="businessName" placeholder="Sucursal Norte" />
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Slogan" k="tagline" placeholder="Tu belleza, nuestra pasión" />
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Teléfono / WhatsApp" k="phone" placeholder="555-100-2000" />
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Correo electrónico" k="email" type="email" placeholder="admin@nailstudio.mx" />
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Dirección" k="address" placeholder="Dirección de la sucursal norte" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Latitud" k="latitude" placeholder="19.4326" />
          <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Longitud" k="longitude" placeholder="-99.1332" />
        </div>
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Instagram" k="instagram" placeholder="@nailstudio.mx" />
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="Facebook" k="facebook" placeholder="facebook.com/nailstudio" />
        <Field settings={secondarySettings} onChange={handleSecondaryChange} label="WhatsApp" k="whatsapp" placeholder="5551002000" />
      </Section>

      <Section title="Configuración de citas">
        <Field settings={settings} onChange={handleChange} label="Máximo de citas por día" k="maxDailyAppts" type="number" placeholder="10" />
        <Field settings={settings} onChange={handleChange} label="Duración predeterminada (minutos)" k="appointmentDuration" type="number" placeholder="60" />
        <Toggle settings={settings} onChange={handleChange} label="Confirmación automática" k="autoConfirm"
          description="Las citas se confirman automáticamente sin revisión manual" />
      </Section>

      <Section title="Notificaciones">
        <Toggle settings={settings} onChange={handleChange} label="Recordatorios por correo" k="reminderEmail"
          description="Enviar recordatorio al cliente antes de su cita" />
        {settings.reminderEmail && (
          <div>
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Enviar recordatorio con anticipación</label>
            <select className="input-field text-sm" value={settings.reminderHours}
              onChange={e => handleChange('reminderHours', e.target.value)}>
              <option value="2">2 horas antes</option>
              <option value="6">6 horas antes</option>
              <option value="12">12 horas antes</option>
              <option value="24">24 horas antes</option>
              <option value="48">48 horas antes</option>
            </select>
          </div>
        )}
      </Section>

      <Section title="Cuentas del equipo">
        <p className="text-sm text-[#6B5A5E]">Crea cuentas con permisos de administrador o trabajadora.</p>
        <input className="input-field text-sm" placeholder="Nombre completo" value={account.name} onChange={e => setAccount(current => ({ ...current, name: e.target.value }))} />
        <input className="input-field text-sm" type="email" placeholder="Correo electrónico" value={account.email} onChange={e => setAccount(current => ({ ...current, email: e.target.value }))} />
        <input className="input-field text-sm" placeholder="Teléfono" value={account.phone} onChange={e => setAccount(current => ({ ...current, phone: e.target.value }))} />
        <input className="input-field text-sm" type="password" placeholder="Contraseña (mínimo 6 caracteres)" value={account.password} onChange={e => setAccount(current => ({ ...current, password: e.target.value }))} />
        <select className="input-field text-sm" value={account.role} onChange={e => setAccount(current => ({ ...current, role: e.target.value as 'admin' | 'worker' }))}>
          <option value="worker">Trabajadora</option>
          <option value="admin">Administrador</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={editingUid ? saveAccount : createAccount}>{editingUid ? 'Guardar cambios' : 'Crear cuenta'}</button>
          {editingUid && <button className="btn-secondary" onClick={() => { setEditingUid(null); setAccount({ name: '', email: '', phone: '', password: '', role: 'worker' }); }}>Cancelar edición</button>}
        </div>
        {accountMessage && <p className="text-sm text-emerald-600">{accountMessage}</p>}
        {accountError && <p className="text-sm text-red-500">{accountError}</p>}
        <div className="border-t border-[#F5EDE6] pt-4 space-y-2">
          {users.filter(item => item.role === 'admin' || item.role === 'worker').map(item => (
            <div key={item.uid} className="flex flex-wrap items-center gap-3 justify-between text-sm border border-[#F5EDE6] rounded-lg p-3">
              <div className="min-w-0"><div className="font-600 text-[#1A1012] truncate">{item.name}</div><div className="text-xs text-[#6B5A5E] truncate">{item.email}</div></div>
              <div className="flex items-center gap-2"><span className="text-xs text-[#6B5A5E]">{item.role === 'admin' ? 'Administrador' : 'Trabajadora'}</span><button className="btn-ghost p-1.5" title="Editar cuenta" onClick={() => editAccount(item)}><Edit2 size={14} /></button><button className="btn-ghost p-1.5 text-red-500" title="Eliminar perfil" onClick={() => removeAccount(item)}><Trash2 size={14} /></button></div>
            </div>
          ))}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
        {saved && <span className="text-sm text-emerald-600">Guardado</span>}
        {saveError && <span className="text-sm text-red-500" role="alert">{saveError}</span>}
      </div>
    </div>
  );
}
