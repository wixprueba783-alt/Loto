import { useState } from "react"
import { BUSINESS_SETTINGS, PRIVACY_POLICY_VERSION, saveBusinessSettings } from "../data"
import type { BusinessSettings, Page, Role } from "../types"

export function PrivacyPolicyPage({ setPage, role }: { setPage: (page: Page) => void; role: Role }) {
  const [policySettings, setPolicySettings] = useState<BusinessSettings>({ ...BUSINESS_SETTINGS })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")
  const isAdmin = role === "admin"
  const responsible =
    policySettings.privacyResponsibleName?.trim() ||
    policySettings.businessName
  const address =
    policySettings.privacyAddress?.trim() ||
    "PENDIENTE: domicilio del responsable"
  const email =
    policySettings.privacyEmail?.trim() ||
    policySettings.email ||
    "PENDIENTE: correo para solicitudes de privacidad"
  const phone =
    policySettings.privacyPhone?.trim() ||
    policySettings.phone ||
    "PENDIENTE: teléfono de contacto"
  const retention =
    policySettings.privacyRetention?.trim() ||
    "PENDIENTE: plazo de conservación y criterios para eliminar o bloquear datos"

  function updatePolicyField(key: keyof BusinessSettings, value: string) {
    setPolicySettings(current => ({ ...current, [key]: value }))
    setSaved(false)
    setSaveError("")
  }

  async function publishPolicy() {
    setSaving(true)
    setSaved(false)
    setSaveError("")
    try {
      await saveBusinessSettings({
        ...BUSINESS_SETTINGS,
        privacyResponsibleName: policySettings.privacyResponsibleName ?? "",
        privacyAddress: policySettings.privacyAddress ?? "",
        privacyEmail: policySettings.privacyEmail ?? "",
        privacyPhone: policySettings.privacyPhone ?? "",
        privacyRetention: policySettings.privacyRetention ?? "",
        privacyPolicyVersion: policySettings.privacyPolicyVersion ?? PRIVACY_POLICY_VERSION,
        privacyPolicyText: policySettings.privacyPolicyText ?? "",
      })
      setPolicySettings({ ...BUSINESS_SETTINGS })
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo publicar la política.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="card mx-auto max-w-4xl space-y-6 p-6 sm:p-9">
      <header>
        <p className="eyebrow">Aviso de privacidad · versión {policySettings.privacyPolicyVersion || PRIVACY_POLICY_VERSION}</p>
        <h1 className="mt-2 text-3xl font-700 text-[var(--color-text)]">
          Política de privacidad
        </h1>
      </header>

      {isAdmin && (
        <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5">
          <div>
            <h2 className="text-lg font-700 text-[var(--color-text)]">Editar y publicar</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Los cambios guardados aquí se muestran en esta página pública. Revisa el contenido antes de publicarlo.
            </p>
          </div>
          {([
            ["privacyResponsibleName", "Responsable del tratamiento", "Nombre o razón social"],
            ["privacyAddress", "Domicilio para privacidad", "Domicilio completo"],
            ["privacyEmail", "Correo para solicitudes ARCO", "privacidad@negocio.mx"],
            ["privacyPhone", "Teléfono de privacidad", "Teléfono de contacto"],
            ["privacyRetention", "Plazos/criterios de conservación", "Completar y revisar con asesoría legal"],
            ["privacyPolicyVersion", "Versión del aviso", "Ej. 2026-11-07-v1"],
          ] as const).map(([key, label, placeholder]) => (
            <label key={key} className="block text-xs font-600 text-[var(--color-text)]">
              {label}
              <input
                className="input-field mt-1 text-sm"
                type={key === "privacyEmail" ? "email" : "text"}
                value={policySettings[key] ?? ""}
                placeholder={placeholder}
                onChange={event => updatePolicyField(key, event.target.value)}
              />
            </label>
          ))}
          <label className="block text-xs font-600 text-[var(--color-text)]">
            Información adicional del negocio
            <textarea
              className="input-field mt-1 min-h-32 text-sm"
              value={policySettings.privacyPolicyText ?? ""}
              placeholder="Agrega información específica del negocio después de validarla."
              onChange={event => updatePolicyField("privacyPolicyText", event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={() => void publishPolicy()} disabled={saving}>
              {saving ? "Publicando..." : "Guardar y publicar"}
            </button>
            {saved && <span className="text-sm text-emerald-500" role="status">Política publicada</span>}
            {saveError && <span className="text-sm text-red-500" role="alert">{saveError}</span>}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-700">Responsable y contacto</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Responsable: <strong>{responsible}</strong>. Domicilio: <strong>{address}</strong>.
          Para ejercer derechos o formular dudas sobre privacidad, escribe a{" "}
          <strong>{email}</strong> o llama al <strong>{phone}</strong>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-700">Datos que podemos tratar</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Nombre y apellidos, teléfono, correo electrónico, datos de acceso cuando se usa autenticación, sucursal elegida, citas, servicios solicitados e historial relacionado. Cuando corresponda, se registran método, importe y comprobantes de pago. No escribas datos de tarjetas ni credenciales en campos libres o comprobantes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-700">Finalidades y proveedores</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Los datos se utilizan para crear y administrar cuentas y citas, confirmar o cambiar horarios, atender pagos, prestar atención al cliente, prevenir reservas duplicadas y cumplir obligaciones aplicables. Firebase presta servicios de autenticación, base de datos y almacenamiento. Si eliges Google, la autenticación usa Google. WhatsApp puede utilizarse para avisos de citas si el servicio está habilitado. Cada proveedor procesa datos conforme a sus propios términos y a la configuración del negocio.
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La publicidad y promociones son opcionales y requieren una elección separada. Rechazarlas no impide reservar ni recibir mensajes operativos necesarios para la cita.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-700">Conservación y seguridad</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Conservación prevista: <strong>{retention}</strong>. El responsable debe definir plazos por categoría, atender obligaciones legales y eliminar, bloquear o disociar datos cuando proceda. Se aplican controles técnicos y administrativos razonables; ningún sistema conectado a Internet puede garantizar seguridad absoluta.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-700">Derechos ARCO y revocación</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Puedes solicitar acceso, rectificación, cancelación u oposición (ARCO), así como revocar consentimientos o limitar el uso o divulgación de datos, mediante los medios de contacto anteriores. Incluye tu nombre, medio para responder, derecho que deseas ejercer y elementos que ayuden a localizar la información. El responsable podrá pedir información para verificar identidad y responderá conforme a los plazos y excepciones previstos en la ley aplicable. La cancelación puede estar limitada por obligaciones legales o por la gestión de citas vigentes.
        </p>
      </section>

      {policySettings.privacyPolicyText?.trim() && (
        <section className="space-y-2">
          <h2 className="text-xl font-700">Información adicional del negocio</h2>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-text-muted)]">
            {policySettings.privacyPolicyText}
          </p>
        </section>
      )}

      <footer className="space-y-3 border-t border-[var(--color-border)] pt-5">
        <p className="text-xs text-[var(--color-text-muted)]">
          El negocio debe mantener actualizados los datos del responsable, los canales de contacto, los plazos de conservación, las transferencias aplicables y el proceso de respuesta a solicitudes.
        </p>
        <button className="btn-secondary" onClick={() => setPage("home")}>
          Volver al inicio
        </button>
      </footer>
    </article>
  )
}
