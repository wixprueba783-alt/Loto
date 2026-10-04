import { useState } from 'react';
import { Mail, Lock, Phone, User, Eye, EyeOff, Sparkles } from 'lucide-react';
import type { Page } from '../types';

interface Props {
  setPage: (p: Page) => void;
  onRegister: (data: { name: string; email: string; phone: string; password: string }) => Promise<void>;
}

function RegisterField({ label, name, type = 'text', icon, placeholder, value, error, onChange, onTogglePassword, showPassword }: {
  label: string;
  name: string;
  type?: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onTogglePassword?: () => void;
  showPassword?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#BBA9AD] pointer-events-none">{icon}</span>
        <input
          className={`input-field register-field ${error ? 'border-red-400' : ''}`}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
        />
        {onTogglePassword && (
          <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BBA9AD]" onClick={onTogglePassword}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function RegisterPage({ setPage, onRegister }: Props) {
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Nombre requerido';
    if (!form.email.includes('@')) e.email = 'Correo inválido';
    if (form.phone.length < 8) e.phone = 'Teléfono inválido';
    if (form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (form.password !== form.confirm) e.confirm = 'Las contraseñas no coinciden';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      setSubmitError('');
      onRegister({ name: form.name, email: form.email, phone: form.phone, password: form.password })
        .catch(error => setSubmitError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.'));
    }
  }

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-6"
      style={{ background: '#080708' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-primary)' }}>
            <Sparkles size={20} color="#1A1316" />
          </div>
          <span className="text-xl font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Loto</span>
        </div>

        <div className="card p-7">
          <h2 className="text-2xl font-700 text-[#1A1012] mb-1 text-center" style={{ fontFamily: 'var(--font-display)' }}>
            Crear cuenta
          </h2>
          <p className="text-sm text-[#6B5A5E] mb-6 text-center">Únete a nuestra comunidad de belleza</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <RegisterField label="Nombre completo" name="name" icon={<User size={16} />} placeholder="Sofía Martínez" value={form.name} error={errors.name} onChange={value => setForm(current => ({ ...current, name: value }))} />
            <RegisterField label="Correo electrónico" name="email" type="email" icon={<Mail size={16} />} placeholder="sofia@email.com" value={form.email} error={errors.email} onChange={value => setForm(current => ({ ...current, email: value }))} />
            <RegisterField label="Teléfono" name="phone" type="tel" icon={<Phone size={16} />} placeholder="555-234-5678" value={form.phone} error={errors.phone} onChange={value => setForm(current => ({ ...current, phone: value }))} />
            <RegisterField label="Contraseña" name="password" type={showPw ? 'text' : 'password'} icon={<Lock size={16} />} placeholder="Mínimo 6 caracteres" value={form.password} error={errors.password} onChange={value => setForm(current => ({ ...current, password: value }))} onTogglePassword={() => setShowPw(current => !current)} showPassword={showPw} />
            <RegisterField label="Confirmar contraseña" name="confirm" type={showPw ? 'text' : 'password'} icon={<Lock size={16} />} placeholder="Repite tu contraseña" value={form.confirm} error={errors.confirm} onChange={value => setForm(current => ({ ...current, confirm: value }))} />

            <button type="submit" className="btn-primary w-full justify-center py-3 text-base mt-2">
              Crear cuenta
            </button>
            {submitError && <p className="text-xs text-red-500 text-center">{submitError}</p>}
          </form>

          <p className="text-center text-xs text-[#BBA9AD] mt-4">
            ¿Ya tienes cuenta?{' '}
            <button className="text-[#E8778A] font-600 hover:underline" onClick={() => setPage('login')}>
              Inicia sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
