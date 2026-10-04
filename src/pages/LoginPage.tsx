import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import type { Page } from '../types';

interface Props {
  setPage: (p: Page) => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ setPage, onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [recoverSent, setRecoverSent] = useState(false);
  const [loginError, setLoginError] = useState('');

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    onLogin(email, password).catch(error => {
      setLoginError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    });
  }

  function handleRecover(e: React.FormEvent) {
    e.preventDefault();
    setRecoverSent(true);
  }

  return (
    <div className="auth-shell min-h-screen flex" style={{ background: '#080708' }}>
      {/* Left decorative panel */}
      <div className="auth-visual hidden lg:flex flex-col justify-center items-center w-5/12 p-12 relative overflow-hidden"
        style={{ background: '#111012' }}>
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white/30"
              style={{ width: 120 + i * 80, height: 120 + i * 80, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative z-10 text-center text-white">
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6">
            <Sparkles size={36} />
          </div>
          <h1 className="text-4xl font-700 mb-3" style={{ fontFamily: 'var(--font-display)' }}>Loto</h1>
          <p className="text-white/80 text-lg leading-relaxed max-w-xs">
            Tu espacio de belleza y cuidado profesional
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 text-sm text-white/70">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-700 text-white mb-1">7+</div>
              <div>Servicios premium</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-700 text-white mb-1">500+</div>
              <div>Clientas felices</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-form flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xs">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-primary)' }}>
              <Sparkles size={20} color="#1A1316" />
            </div>
            <span className="text-xl font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Loto</span>
          </div>

          {mode === 'login' && (
            <>
              <h2 className="text-2xl font-700 text-[#1A1012] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Bienvenida de vuelta</h2>
              <p className="text-sm text-[#6B5A5E] mb-5">Ingresa a tu cuenta para continuar</p>

              <button className="w-full mb-5 rounded-xl border border-[#E8778A] bg-[#FFF1F3] px-4 py-2.5 text-sm font-600 text-[#C1536A] transition-colors hover:bg-[#FFE4E8]" onClick={() => setPage('home')}>
                Continuar como invitada
              </button>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Correo electrónico</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BBA9AD] pointer-events-none" />
                    <input className="input-field has-leading-icon" type="email" placeholder="sofia@email.com"
                      value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BBA9AD] pointer-events-none" />
                    <input className="input-field has-leading-icon has-trailing-icon" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#BBA9AD] hover:text-[#E8778A]"
                      onClick={() => setShowPw(!showPw)}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" className="text-xs text-[#E8778A] hover:underline font-500"
                    onClick={() => setMode('recover')}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3 text-base">
                  Iniciar sesión
                </button>
                {loginError && <p className="text-xs text-red-500 text-center">{loginError}</p>}
              </form>

              <div className="mt-4 text-center text-xs text-[#BBA9AD]">
                <span>¿No tienes cuenta? </span>
                <button className="text-[#E8778A] font-600 hover:underline" onClick={() => setPage('register')}>
                  Regístrate
                </button>
              </div>
              <div className="mt-5 p-3 bg-[#FFF1F3] rounded-xl border border-[#FECDD5] text-xs text-[#6B5A5E]">
                <p>Usa el correo y contraseña registrados en Firebase Authentication.</p>
              </div>
            </>
          )}

          {mode === 'recover' && !recoverSent && (
            <>
              <h2 className="text-2xl font-700 text-[#1A1012] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Recuperar contraseña</h2>
              <p className="text-sm text-[#6B5A5E] mb-7">Ingresa tu correo y te enviaremos un enlace de recuperación</p>
              <form onSubmit={handleRecover} className="space-y-4">
                <div>
                  <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">Correo electrónico</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BBA9AD]" />
                    <input className="input-field pl-9" type="email" placeholder="sofia@email.com" required />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3">
                  Enviar enlace
                </button>
                <button type="button" className="btn-ghost w-full justify-center text-sm" onClick={() => setMode('login')}>
                  ← Volver al login
                </button>
              </form>
            </>
          )}

          {mode === 'recover' && recoverSent && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#FFF1F3] flex items-center justify-center mx-auto mb-4">
                <Mail size={28} className="text-[#E8778A]" />
              </div>
              <h2 className="text-2xl font-700 text-[#1A1012] mb-2" style={{ fontFamily: 'var(--font-display)' }}>¡Correo enviado!</h2>
              <p className="text-sm text-[#6B5A5E] mb-6">Revisa tu bandeja de entrada y sigue las instrucciones.</p>
              <button className="btn-primary justify-center" onClick={() => { setMode('login'); setRecoverSent(false); }}>
                Volver al login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
