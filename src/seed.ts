// Script de datos iniciales. Impórtalo UNA SOLA VEZ desde main.tsx
// (import './seed';), corre la app, espera a ver "Seed completo ✅"
// en la consola del navegador, y después borra ese import para que
// no se vuelva a ejecutar en cada carga.

import { db, authReady } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

async function seed() {
  await authReady;

  const services = [
    { id: 's1', name: 'Manicura clásica', description: 'Limado, cutícula, base y esmalte tradicional. Incluye hidratación de manos con crema premium.', price: 220, duration: 45, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format', category: 'Manicura', active: true },
    { id: 's2', name: 'Gel Semipermanente', description: 'Esmalte en gel de larga duración hasta 3 semanas. Sin astillas ni manchas. Acabado brillante o mate.', price: 380, duration: 60, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format', category: 'Gel', active: true },
    { id: 's3', name: 'Uñas Acrílicas', description: 'Extensiones de acrílico resistentes con forma personalizada. Natural o fantasia. Alta durabilidad.', price: 550, duration: 90, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format', category: 'Acrílico', active: true },
    { id: 's4', name: 'Uñas de Gel', description: 'Extensiones de gel ultraligeras con acabado natural. Máxima flexibilidad y aspecto saludable.', price: 520, duration: 90, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format', category: 'Gel', active: true },
    { id: 's5', name: 'Arte en uñas', description: 'Diseños artísticos únicos: flores, geometría, degradados, pedrería y diseños personalizados.', price: 180, duration: 45, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format', category: 'Arte', active: true },
    { id: 's6', name: 'Retiro', description: 'Retiro seguro y profesional de gel, acrílico o semipermanente sin dañar la uña natural.', price: 150, duration: 30, image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&auto=format', category: 'Retiro', active: true },
    { id: 's7', name: 'Pedicura spa', description: 'Exfoliación, baño relajante, masaje de pies y piernas, hidratación profunda y esmaltado.', price: 320, duration: 75, image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=400&h=300&fit=crop&auto=format', category: 'Pedicura', active: true },
  ];
  for (const s of services) {
    const { id, ...rest } = s;
    await setDoc(doc(db, 'services', id), rest);
  }

  const galleryPhotos = [
    { id: 'g1', url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop&auto=format', serviceId: 's1', alt: 'Manicura clásica rosada', order: 1 },
    { id: 'g2', url: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=400&h=400&fit=crop&auto=format', serviceId: 's7', alt: 'Pedicura spa relajante', order: 2 },
    { id: 'g3', url: 'https://images.unsplash.com/photo-1604902396830-aca29e19b067?w=400&h=400&fit=crop&auto=format', serviceId: 's2', alt: 'Gel semipermanente', order: 3 },
    { id: 'g4', url: 'https://images.unsplash.com/photo-1604902520430-bd09e0c2a1c7?w=400&h=400&fit=crop&auto=format', serviceId: 's3', alt: 'Uñas acrílicas elegantes', order: 4 },
    { id: 'g5', url: 'https://images.unsplash.com/photo-1604902520412-f45f5a3f0b17?w=400&h=400&fit=crop&auto=format', serviceId: 's4', alt: 'Uñas de gel naturales', order: 5 },
    { id: 'g6', url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=500&fit=crop&auto=format', serviceId: 's5', alt: 'Arte floral en uñas', order: 6 },
  ];
  for (const g of galleryPhotos) {
    const { id, ...rest } = g;
    await setDoc(doc(db, 'galleryPhotos', id), rest);
  }

  const blockedDays = [
    { date: '2026-09-22', reason: 'Día festivo' },
    { date: '2026-09-28', reason: 'Vacaciones' },
  ];
  for (const d of blockedDays) {
    await setDoc(doc(db, 'blockedDays', d.date), d);
  }

  const blockedTimes = [
    { date: '2026-09-23', time: '14:00', reason: 'Ocupado' },
    { date: '2026-09-23', time: '15:00', reason: 'Ocupado' },
    { date: '2026-09-24', time: '10:00', reason: 'Cita previa' },
  ];
  for (const t of blockedTimes) {
    await setDoc(doc(db, 'blockedTimes', `${t.date}_${t.time}`), t);
  }

  await setDoc(doc(db, 'settings', 'general'), {
    workHours: ['09:00', '10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00'],
    defaultOpen: '09:00',
    defaultClose: '18:00',
    fridayClose: '19:00',
    saturdayOpen: '10:00',
    saturdayClose: '16:00',
    closedOnSunday: true,
  }, { merge: true });

  console.log('Seed completo ✅');
}

seed();
