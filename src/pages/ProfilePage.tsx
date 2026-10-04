import { useState } from 'react';
import { Camera, Edit3, Check, X } from 'lucide-react';
import { APPOINTMENTS, MONTHS } from '../data';
import { AppointmentBadge } from '../components/StatusBadge';
import type { BranchId, User } from '../types';

interface Props { user: User; branchId: BranchId; onUpdate: (u: User) => void; }

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

export function ProfilePage({ user, branchId, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(user);

  const myAppts = APPOINTMENTS
    .filter(a => (a.branchId ?? 'main') === branchId && a.status !== 'cancelled' && (user.uid ? a.ownerUid === user.uid : a.clientEmail === user.email))
    .sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`));
  const stats = {
    total: myAppts.length,
    completed: myAppts.filter(a => a.status === 'completed').length,
    upcoming: myAppts.filter(a => a.status === 'confirmed' || a.status === 'pending').length,
    spent: myAppts.filter(a => a.status === 'completed').reduce((s, a) => s + a.total, 0),
  };

  function save() {
    onUpdate(form);
    setEditing(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#FECDD5]">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[#C1536A] text-2xl font-700">{user.name.charAt(0)}</div>
              }
            </div>
            {editing && (
              <button className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#E8778A] flex items-center justify-center text-white shadow-md">
                <Camera size={13} />
              </button>
            )}
          </div>
          <div className="flex-1">
            {!editing ? (
              <>
                <h2 className="text-xl font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>{user.name}</h2>
                <p className="text-sm text-[#6B5A5E] mb-1">{user.email}</p>
                <p className="text-sm text-[#6B5A5E]">{user.phone}</p>
              </>
            ) : (
              <div className="space-y-3">
                {['name', 'email', 'phone'].map(field => (
                  <input key={field} className="input-field text-sm"
                    value={form[field as keyof typeof form] || ''}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field === 'name' ? 'Nombre' : field === 'email' ? 'Correo' : 'Teléfono'}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            {!editing ? (
              <button className="btn-secondary py-2 px-4" onClick={() => setEditing(true)}>
                <Edit3 size={14} /> Editar
              </button>
            ) : (
              <div className="flex gap-2">
                <button className="btn-primary py-2 px-3" onClick={save}><Check size={14} /></button>
                <button className="btn-ghost py-2 px-3" onClick={() => { setForm(user); setEditing(false); }}><X size={14} /></button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#F5EDE6]">
          {[
            { label: 'Total citas', value: stats.total },
            { label: 'Completadas', value: stats.completed },
            { label: 'Próximas', value: stats.upcoming },
            { label: 'Gastado', value: `$${stats.spent}` },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-lg font-700 text-[#C1536A]">{s.value}</div>
              <div className="text-xs text-[#6B5A5E] font-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Appointment history */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-[#F5EDE6]">
          <h3 className="font-700 text-[#1A1012]" style={{ fontFamily: 'var(--font-display)' }}>Historial de citas</h3>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {myAppts.map(appt => (
            <div key={appt.id} className="rounded-xl border border-[#F0E5E0] bg-[#FFFCFB] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F5EDE6] flex-shrink-0">
                  <img src={appt.service.image} alt={appt.service.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-700 text-[#1A1012] truncate">{(appt.services ?? [appt.service]).map(service => service.name).join(' + ')}</div>
                  <div className="text-sm text-[#6B5A5E] mt-1">{formatDate(appt.date)} · {appt.time}</div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 sm:min-w-[190px]">
                <span className="text-lg font-700 text-[#C1536A]">${appt.total}</span>
                <AppointmentBadge status={appt.status} />
              </div>
            </div>
          ))}
        </div>
        {myAppts.length === 0 && <div className="px-6 py-12 text-center text-[#9B898B]">Aún no tienes citas registradas.</div>}
      </div>
    </div>
  );
}
