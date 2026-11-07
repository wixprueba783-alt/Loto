import { useState, useEffect, type ReactNode } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  LoaderCircle,
  History,
  QrCode,
  Save,
  Trash2,
  Upload,
} from "lucide-react"
import {
  BRANCH_LABEL,
  BUSINESS_SETTINGS,
  DEFAULT_WHATSAPP_AUTOMATIONS,
  deleteManagedUser,
  getUsers,
  saveBusinessSettings,
  saveUserProfile,
  prepareHomepageImage,
  updateManagedUser,
} from "../../data"
import QRCode from "qrcode"
import { auth, createManagedAccount } from "../../firebase"
import { whatsappApiUrl } from "../../whatsapp-api"
import type { BranchBusinessSettings, BranchId, PublicBusinessHours, Role, User, WhatsAppAutomationKey } from "../../types"

type Settings = typeof BUSINESS_SETTINGS
type SecondarySettings = BranchBusinessSettings

interface WhatsAppStatus {
  state: "starting" | "pairing" | "connected" | "disconnected" | "error"
  qr: string | null
  message: string
}

interface WhatsAppMessageLogEntry {
  id: string
  appointmentId: string
  branchId: BranchId
  stage: string
  status: "pending" | "sent" | "failed"
  recipientMasked: string
  error?: string
  createdAt: string | null
  acceptedAt: string | null
  failedAt: string | null
}

async function fetchWhatsAppWithRetry(input: string, init?: RequestInit) {
  let lastError: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error
      if (attempt < 5) {
        await new Promise((resolve) => window.setTimeout(resolve, 5000))
      }
    }
  }
  throw lastError
}

const automationLabels: Record<WhatsAppAutomationKey, string> = {
  received: "Solicitud recibida",
  confirmed: "Cita confirmada",
  reminder: "Recordatorio automático",
};

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="card p-6">
      <h3
        className="font-700 text-[#1A1012] mb-5 flex items-center gap-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field<T extends object>({
  settings,
  onChange,
  label,
  k,
  type = "text",
  placeholder,
}: {
  settings: T
  onChange: (key: string, value: string | boolean) => void
  label: string
  k: string
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">
        {label}
      </label>
      <input
        className="input-field text-sm"
        type={type}
        placeholder={placeholder}
        value={String(settings[(k as keyof T)] ?? "")}
        onChange={(e) => onChange(k, e.target.value)}
      />
    </div>
  )
}

function Toggle({
  settings,
  onChange,
  label,
  k,
  description,
}: {
  settings: Settings
  onChange: (key: string, value: string | boolean) => void
  label: string
  k: string
  description?: string
}) {
  const enabled = Boolean(settings[(k as keyof Settings)])
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-500 text-[#1A1012]">{label}</div>
        {description && (
          <div className="text-xs text-[#BBA9AD] mt-0.5">{description}</div>
        )}
      </div>
      <button
        type="button"
        aria-pressed={enabled}
        className={`toggle-track ${
          enabled ? "is-on bg-[#E8778A]" : "bg-[#EDD9CC]"
        }`}
        onClick={() => onChange(k, !enabled)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  )
}

export function AdminSettingsPage({ branchId }: { branchId: BranchId }) {
  const [settings, setSettings] = useState(BUSINESS_SETTINGS)
  const [secondarySettings, setSecondarySettings] = useState<SecondarySettings>(
    BUSINESS_SETTINGS.secondaryBranch!,
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [preparingHomepageImage, setPreparingHomepageImage] = useState<"hero" | "about" | null>(null)
  const [homepageImageError, setHomepageImageError] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [account, setAccount] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "worker" as Exclude<Role, "guest" | "client">,
    branchId: "main" as BranchId,
  })
  const [accountMessage, setAccountMessage] = useState("")
  const [accountError, setAccountError] = useState("")
  const [editingUid, setEditingUid] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    state: "starting",
    qr: null,
    message: "Consultando el estado de WhatsApp…",
  })
  const [whatsappQrDataUrl, setWhatsappQrDataUrl] = useState<string | null>(null)
  const [whatsappHistory, setWhatsappHistory] = useState<WhatsAppMessageLogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const savedWhatsAppAutomations = settings.whatsappAutomations
  const whatsappAutomations = {
    ...DEFAULT_WHATSAPP_AUTOMATIONS,
    ...savedWhatsAppAutomations,
    enabled: {
      ...DEFAULT_WHATSAPP_AUTOMATIONS.enabled,
      ...savedWhatsAppAutomations?.enabled,
    },
    templates: savedWhatsAppAutomations?.templateVersion === 2
      ? { ...DEFAULT_WHATSAPP_AUTOMATIONS.templates, ...savedWhatsAppAutomations.templates }
      : { ...DEFAULT_WHATSAPP_AUTOMATIONS.templates },
  }

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    void loadWhatsAppHistory()
  }, [])

  async function loadWhatsAppHistory() {
    setHistoryLoading(true)
    setHistoryError("")
    try {
      const currentUser = auth.currentUser
      if (!currentUser || currentUser.isAnonymous) {
        throw new Error("Inicia sesión como administrador para consultar el historial.")
      }
      const token = await currentUser.getIdToken()
      const response = await fetch(whatsappApiUrl("history"), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      })
      const result = await response.json() as WhatsAppMessageLogEntry[] | { message?: string }
      if (!response.ok) {
        const message = !Array.isArray(result) ? result.message : undefined
        throw new Error(message || "No se pudo consultar el historial.")
      }
      if (!Array.isArray(result)) throw new Error("El servicio devolvió un historial inválido.")
      setWhatsappHistory(result.filter(entry =>
        ["received", "confirmed", "reminder"].includes(entry.stage),
      ))
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "No se pudo cargar el historial.")
    } finally {
      setHistoryLoading(false)
    }
  }

  function updateAutomationSetting(
    section: "enabled" | "reminderHours",
    key: string,
    value: boolean | number,
  ) {
    setSettings((current) => {
      const currentAutomation = current.whatsappAutomations ?? DEFAULT_WHATSAPP_AUTOMATIONS
      if (section === "reminderHours" && typeof value === "number") {
        return {
          ...current,
          whatsappAutomations: { ...currentAutomation, reminderHours: value },
        }
      }
      if (section !== "enabled" || typeof value !== "boolean") {
        throw new Error("El valor de automatización de WhatsApp no es válido.")
      }
      return {
        ...current,
        whatsappAutomations: {
          ...currentAutomation,
          enabled: { ...currentAutomation.enabled, [key]: value },
        },
      }
    })
  }

  function updateAutomationTemplate(key: WhatsAppAutomationKey, value: string) {
    setSettings((current) => {
      const currentAutomation = current.whatsappAutomations ?? DEFAULT_WHATSAPP_AUTOMATIONS
      const templates = currentAutomation.templateVersion === 2
        ? currentAutomation.templates ?? DEFAULT_WHATSAPP_AUTOMATIONS.templates
        : DEFAULT_WHATSAPP_AUTOMATIONS.templates
      return {
        ...current,
        whatsappAutomations: {
          ...currentAutomation,
          templateVersion: 2,
          templates: { ...templates, [key]: value },
        },
      }
    })
  }

  useEffect(() => {
    let active = true
    async function refreshWhatsAppStatus() {
      try {
        const currentUser = auth.currentUser
        if (!currentUser || currentUser.isAnonymous) {
          throw new Error(
            "Inicia sesión con tu cuenta de administrador para consultar WhatsApp.",
          )
        }
        const token = await currentUser.getIdToken()
        const response = await fetchWhatsAppWithRetry(whatsappApiUrl("status"), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        })
        if (
          !response.headers
            .get("content-type")
            ?.toLowerCase()
            .includes("application/json")
        ) {
          throw new Error(
            "Esta página no pudo conectar con el servicio de WhatsApp en Render. Vuelve a iniciar sesión e inténtalo de nuevo.",
          )
        }
        const result = (await response.json()) as WhatsAppStatus & {
          message?: string
        }
        if (!response.ok)
          throw new Error(
            result.message || "No se pudo consultar el estado de WhatsApp.",
          )
        if (active) setWhatsappStatus(result)
      } catch (error) {
        if (active) {
          setWhatsappStatus({
            state: "error",
            qr: null,
            message:
              error instanceof Error
                ? error.message
                : "No se pudo conectar con el servicio de WhatsApp.",
          })
        }
      }
    }
    void refreshWhatsAppStatus()
    const interval = window.setInterval(
      () => void refreshWhatsAppStatus(),
      3000,
    )
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true
    setWhatsappQrDataUrl(null)

    if (!whatsappStatus.qr) return

    const colors =
      branchId === "north"
        ? { dark: "#6B7650", light: "#FFFFFF" }
        : { dark: "#1A1012", light: "#FFF1F3" }

    void QRCode.toDataURL(whatsappStatus.qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      color: colors,
    })
      .then((dataUrl) => {
        if (active) setWhatsappQrDataUrl(dataUrl)
      })
      .catch((error: unknown) => {
        console.error("No se pudo generar el código QR de WhatsApp:", error)
        if (active) {
          setWhatsappQrDataUrl(null)
          setWhatsappStatus((current) => ({
            ...current,
            state: "error",
            message: "No se pudo generar el código QR de WhatsApp.",
          }))
        }
      })

    return () => {
      active = false
    }
  }, [branchId, whatsappStatus.qr])

  useEffect(() => {
    setSettings(BUSINESS_SETTINGS)
    setSecondarySettings(
      BUSINESS_SETTINGS.secondaryBranch ?? {
        businessName: "",
        tagline: "",
        phone: "",
        email: "",
        address: "",
        instagram: "",
        facebook: "",
        whatsapp: "",
        latitude: "",
        longitude: "",
      },
    )
  }, [
    BUSINESS_SETTINGS.businessName,
    BUSINESS_SETTINGS.tagline,
    BUSINESS_SETTINGS.phone,
    BUSINESS_SETTINGS.email,
    BUSINESS_SETTINGS.address,
    BUSINESS_SETTINGS.instagram,
    BUSINESS_SETTINGS.facebook,
    BUSINESS_SETTINGS.whatsapp,
    BUSINESS_SETTINGS.latitude,
    BUSINESS_SETTINGS.longitude,
    BUSINESS_SETTINGS.autoConfirm,
    BUSINESS_SETTINGS.reminderEmail,
    BUSINESS_SETTINGS.reminderHours,
    BUSINESS_SETTINGS.maxDailyAppts,
    BUSINESS_SETTINGS.appointmentDuration,
    JSON.stringify(BUSINESS_SETTINGS.publicHours),
    BUSINESS_SETTINGS.homepageHeroImage,
    BUSINESS_SETTINGS.homepageAboutImage,
    JSON.stringify(BUSINESS_SETTINGS.categories),
    BUSINESS_SETTINGS.secondaryBranch?.businessName,
    BUSINESS_SETTINGS.secondaryBranch?.tagline,
    BUSINESS_SETTINGS.secondaryBranch?.phone,
    BUSINESS_SETTINGS.secondaryBranch?.email,
    BUSINESS_SETTINGS.secondaryBranch?.address,
    BUSINESS_SETTINGS.secondaryBranch?.instagram,
    BUSINESS_SETTINGS.secondaryBranch?.facebook,
    BUSINESS_SETTINGS.secondaryBranch?.whatsapp,
    BUSINESS_SETTINGS.secondaryBranch?.latitude,
    BUSINESS_SETTINGS.secondaryBranch?.longitude,
    JSON.stringify(BUSINESS_SETTINGS.branchColors),
    BUSINESS_SETTINGS.privacyResponsibleName,
    BUSINESS_SETTINGS.privacyAddress,
    BUSINESS_SETTINGS.privacyEmail,
    BUSINESS_SETTINGS.privacyPhone,
    BUSINESS_SETTINGS.privacyRetention,
    BUSINESS_SETTINGS.privacyPolicyText,
    BUSINESS_SETTINGS.privacyPolicyVersion,
  ])

  function handleChange(k: string, v: string | boolean) {
    setSettings((prev) => ({ ...prev, [k]: v }))
  }

  function handleSecondaryChange(k: string, v: string | boolean) {
    setSecondarySettings((previous) => ({ ...previous, [k]: v }))
  }

  function handlePublicHoursChange<K extends keyof PublicBusinessHours>(
    day: K,
    value: PublicBusinessHours[K],
  ) {
    setSettings((current) => ({
      ...current,
      publicHours: {
        weekdays: current.publicHours?.weekdays ?? { open: "09:00", close: "19:00" },
        saturday: current.publicHours?.saturday ?? { open: "09:00", close: "17:00" },
        sunday: current.publicHours?.sunday ?? "Bajo disposición",
        [day]: value,
      },
    }))
    setSaved(false)
  }

  function handleBranchColorChange(id: BranchId, value: string) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return
    setSettings((current) => ({
      ...current,
      branchColors: {
        main: current.branchColors?.main || "#D99A9F",
        north: current.branchColors?.north || "#BBC58E",
        [id]: value.toUpperCase(),
      },
    }))
  }

  async function handleHomepageImageChange(section: "hero" | "about", file?: File) {
    if (!file) return
    setPreparingHomepageImage(section)
    setHomepageImageError("")
    try {
      const url = await prepareHomepageImage(file)
      const key = section === "hero" ? "homepageHeroImage" : "homepageAboutImage"
      setSettings((current) => ({ ...current, [key]: url }))
      setSaved(false)
    } catch (error) {
      setHomepageImageError(error instanceof Error ? error.message : "No se pudo preparar la fotografía.")
    } finally {
      setPreparingHomepageImage(null)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    setSaved(false)
    try {
      await saveBusinessSettings({
        ...settings,
        secondaryBranch: secondarySettings,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function findAddressFromCoordinates() {
    const latitude = Number(settings.latitude)
    const longitude = Number(settings.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setAccountError("Escribe una latitud y longitud válidas.")
      return
    }
    setLocating(true)
    setAccountError("")
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=es`,
      )
      if (!response.ok) throw new Error("No se pudo consultar la dirección.")
      const result = (await response.json()) as { display_name?: string }
      if (!result.display_name)
        throw new Error("No se encontró una dirección para esas coordenadas.")
      setSettings((current) => ({
        ...current,
        address: result.display_name || current.address,
      }))
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "No se pudo obtener la dirección.",
      )
    } finally {
      setLocating(false)
    }
  }

  async function createAccount() {
    setAccountError("")
    setAccountMessage("")
    if (
      !account.name.trim() ||
      !account.email.trim() ||
      account.password.length < 6
    ) {
      setAccountError(
        "Completa nombre, correo y una contraseña de al menos 6 caracteres.",
      )
      return
    }
    try {
      const uid = await createManagedAccount(
        account.email.trim(),
        account.password,
      )
      await saveUserProfile(uid, {
        name: account.name.trim(),
        email: account.email.trim(),
        phone: account.phone.trim(),
        role: account.role,
        ...(account.role === "branchAdmin" || account.role === "worker" ? { branchId: account.branchId } : {}),
      })
      setUsers((current) => [
        ...current,
        {
          uid,
          name: account.name,
          email: account.email,
          phone: account.phone,
          role: account.role,
          ...(account.role === "branchAdmin" || account.role === "worker" ? { branchId: account.branchId } : {}),
        },
      ])
      setAccount({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "worker",
        branchId: "main",
      })
      setAccountMessage("Cuenta creada correctamente.")
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "No se pudo crear la cuenta.",
      )
    }
  }

  function editAccount(item: User) {
    setEditingUid(item.uid || null)
    setAccount({
      name: item.name,
      email: item.email,
      phone: item.phone,
      password: "",
      role: item.role === "admin" ? "admin" : item.role === "branchAdmin" ? "branchAdmin" : "worker",
      branchId: item.branchId ?? "main",
    })
    setAccountError("")
    setAccountMessage("")
  }

  async function saveAccount() {
    if (!editingUid) return
    setAccountError("")
    try {
      await updateManagedUser(editingUid, {
        name: account.name.trim(),
        email: account.email.trim(),
        phone: account.phone.trim(),
        role: account.role,
        ...(account.role === "branchAdmin" || account.role === "worker" ? { branchId: account.branchId } : {}),
      })
      setUsers((current) =>
        current.map((item) =>
          item.uid === editingUid
            ? {
                ...item,
                name: account.name.trim(),
                email: account.email.trim(),
                phone: account.phone.trim(),
                role: account.role,
                ...(account.role === "branchAdmin" || account.role === "worker" ? { branchId: account.branchId } : {}),
              }
            : item,
        ),
      )
      setEditingUid(null)
      setAccountMessage("Cuenta actualizada.")
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la cuenta.",
      )
    }
  }

  async function removeAccount(item: User) {
    if (!item.uid || !window.confirm(`¿Eliminar el perfil de ${item.name}?`))
      return
    try {
      await deleteManagedUser(item.uid)
      setUsers((current) => current.filter((user) => user.uid !== item.uid))
      setAccountMessage(
        "Perfil eliminado. La cuenta de Authentication debe eliminarse desde Firebase Console o una Cloud Function.",
      )
    } catch (error) {
      setAccountError(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el perfil.",
      )
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="Información del negocio">
        <Field
          settings={settings}
          onChange={handleChange}
          label="Nombre del negocio"
          k="businessName"
          placeholder="Estudio de uñas"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="Slogan"
          k="tagline"
          placeholder="Tu belleza, nuestra pasión"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="Teléfono / WhatsApp"
          k="phone"
          placeholder="555-100-2000"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="Correo electrónico"
          k="email"
          type="email"
          placeholder="admin@nailstudio.mx"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="Dirección"
          k="address"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            settings={settings}
            onChange={handleChange}
            label="Latitud"
            k="latitude"
            placeholder="19.4326"
          />
          <Field
            settings={settings}
            onChange={handleChange}
            label="Longitud"
            k="longitude"
            placeholder="-99.1332"
          />
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={findAddressFromCoordinates}
          disabled={locating}
        >
          {locating
            ? "Buscando dirección..."
            : "Obtener dirección desde coordenadas"}
        </button>
        <Field
          settings={settings}
          onChange={handleChange}
          label="Instagram"
          k="instagram"
          placeholder="@nailstudio.mx"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="Facebook"
          k="facebook"
          placeholder="facebook.com/nailstudio"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="WhatsApp"
          k="whatsapp"
          placeholder="5551002000"
        />
      </Section>

      <Section title="Horarios que se muestran en Inicio">
        <p className="text-sm text-[#6B5A5E]">
          Estos horarios informativos se guardan en la configuración de Firebase y se actualizan en la página de Inicio al guardar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            settings={settings.publicHours?.weekdays ?? { open: "09:00", close: "19:00" }}
            onChange={(key, value) => handlePublicHoursChange("weekdays", {
              ...(settings.publicHours?.weekdays ?? { open: "09:00", close: "19:00" }),
              [key]: value,
            })}
            label="Lunes a viernes · desde"
            k="open"
            type="time"
          />
          <Field
            settings={settings.publicHours?.weekdays ?? { open: "09:00", close: "19:00" }}
            onChange={(key, value) => handlePublicHoursChange("weekdays", {
              ...(settings.publicHours?.weekdays ?? { open: "09:00", close: "19:00" }),
              [key]: value,
            })}
            label="Lunes a viernes · hasta"
            k="close"
            type="time"
          />
          <Field
            settings={settings.publicHours?.saturday ?? { open: "09:00", close: "17:00" }}
            onChange={(key, value) => handlePublicHoursChange("saturday", {
              ...(settings.publicHours?.saturday ?? { open: "09:00", close: "17:00" }),
              [key]: value,
            })}
            label="Sábado · desde"
            k="open"
            type="time"
          />
          <Field
            settings={settings.publicHours?.saturday ?? { open: "09:00", close: "17:00" }}
            onChange={(key, value) => handlePublicHoursChange("saturday", {
              ...(settings.publicHours?.saturday ?? { open: "09:00", close: "17:00" }),
              [key]: value,
            })}
            label="Sábado · hasta"
            k="close"
            type="time"
          />
        </div>
        <Field
          settings={{ sunday: settings.publicHours?.sunday ?? "Bajo disposición" }}
          onChange={(_key, value) => handlePublicHoursChange("sunday", String(value))}
          label="Domingo"
          k="sunday"
          placeholder="Cerrado o Bajo disposición"
        />
      </Section>

      <Section title={BRANCH_LABEL.north}>
        <p className="text-sm text-[#6B5A5E]">
          Información independiente que verán los clientes cuando elijan la
          sucursal de Escobedo. El catálogo de servicios se comparte entre sucursales.
        </p>
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Nombre del negocio"
          k="businessName"
          placeholder={BRANCH_LABEL.north}
        />
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Slogan"
          k="tagline"
          placeholder="Tu belleza, nuestra pasión"
        />
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Teléfono / WhatsApp"
          k="phone"
          placeholder="555-100-2000"
        />
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Correo electrónico"
          k="email"
          type="email"
          placeholder="admin@nailstudio.mx"
        />
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Dirección"
          k="address"
          placeholder="Dirección de la sucursal norte"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            settings={secondarySettings}
            onChange={handleSecondaryChange}
            label="Latitud"
            k="latitude"
            placeholder="19.4326"
          />
          <Field
            settings={secondarySettings}
            onChange={handleSecondaryChange}
            label="Longitud"
            k="longitude"
            placeholder="-99.1332"
          />
        </div>
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Instagram"
          k="instagram"
          placeholder="@nailstudio.mx"
        />
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="Facebook"
          k="facebook"
          placeholder="facebook.com/nailstudio"
        />
        <Field
          settings={secondarySettings}
          onChange={handleSecondaryChange}
          label="WhatsApp"
          k="whatsapp"
          placeholder="5551002000"
        />
      </Section>

      <Section title="Configuración de citas">
        <Field
          settings={settings}
          onChange={handleChange}
          label="Máximo de citas por día"
          k="maxDailyAppts"
          type="number"
          placeholder="10"
        />
        <Field
          settings={settings}
          onChange={handleChange}
          label="Duración predeterminada (minutos)"
          k="appointmentDuration"
          type="number"
          placeholder="60"
        />
        <Toggle
          settings={settings}
          onChange={handleChange}
          label="Confirmación automática"
          k="autoConfirm"
          description="Las citas se confirman automáticamente sin revisión manual"
        />
      </Section>

      <Section title="Notificaciones">
        <Toggle
          settings={settings}
          onChange={handleChange}
          label="Recordatorios por correo"
          k="reminderEmail"
          description="Enviar recordatorio al cliente antes de su cita"
        />
        {settings.reminderEmail && (
          <div>
            <label className="block text-xs font-600 text-[#3D2A2F] mb-1.5">
              Enviar recordatorio con anticipación
            </label>
            <select
              className="input-field text-sm"
              value={settings.reminderHours}
              onChange={(e) => handleChange("reminderHours", e.target.value)}
            >
              <option value="2">2 horas antes</option>
              <option value="6">6 horas antes</option>
              <option value="12">12 horas antes</option>
              <option value="24">24 horas antes</option>
              <option value="48">48 horas antes</option>
            </select>
          </div>
        )}
      </Section>

      <Section title="Personalización visual y paleta de colores">
        <p className="text-sm text-[var(--color-text-muted)]">
          El cambio se limita a la sucursal elegida. Puedes probar el color y guardarlo junto con la configuración general.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { id: "main" as const, label: BRANCH_LABEL.main, original: "#D99A9F" },
            { id: "north" as const, label: BRANCH_LABEL.north, original: "#BBC58E" },
          ]).map((branch) => {
            const color = settings.branchColors?.[branch.id] || branch.original
            return (
              <div key={branch.id} className="space-y-3 rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="font-700 text-[var(--color-text)]">{branch.label}</h4>
                <div className="flex items-center gap-3">
                  <input aria-label={`Elegir color de ${branch.label}`} type="color" value={color}
                    className="h-11 w-14 cursor-pointer rounded border-0 bg-transparent"
                    onChange={(event) => handleBranchColorChange(branch.id, event.target.value)} />
                  <input aria-label={`Código HEX de ${branch.label}`} className="input-field"
                    value={color} maxLength={7} pattern="^#[0-9A-Fa-f]{6}$"
                    onChange={(event) => handleBranchColorChange(branch.id, event.target.value)} />
                  <button type="button" className="btn-ghost px-2 text-xs"
                    onClick={() => handleBranchColorChange(branch.id, branch.original)}>
                    Restaurar
                  </button>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3" style={{ "--color-primary": color } as React.CSSProperties}>
                  <div className="mb-2 h-2 rounded-full" style={{ background: color }} />
                  <button type="button" className="btn-primary">Vista previa</button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Fotografías de la página de inicio">
        <p className="text-sm text-[var(--color-text-muted)]">
          Cambia las dos imágenes destacadas de Inicio. Las fotos se optimizan en el navegador; después, guarda la configuración general para publicarlas.
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {([
            { section: "hero" as const, key: "homepageHeroImage" as const, label: "Fotografía principal" },
            { section: "about" as const, key: "homepageAboutImage" as const, label: "Fotografía de bienvenida" },
          ]).map((image) => (
            <div key={image.section} className="space-y-3">
              <h4 className="text-sm font-600 text-[var(--color-text)]">{image.label}</h4>
              <img
                src={settings[image.key] || ""}
                alt={`Vista previa: ${image.label}`}
                className="h-44 w-full rounded-lg border border-[var(--color-border)] object-cover"
              />
              <label className="btn-secondary w-full justify-center cursor-pointer">
                <Upload size={15} />
                {preparingHomepageImage === image.section
                  ? "Preparando fotografía..."
                  : settings[image.key] !== BUSINESS_SETTINGS[image.key]
                    ? "Cambiar fotografía"
                    : "Elegir fotografía"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={preparingHomepageImage !== null}
                  onChange={(event) => {
                    void handleHomepageImageChange(image.section, event.currentTarget.files?.[0])
                    event.currentTarget.value = ""
                  }}
                />
              </label>
              {settings[image.key] !== BUSINESS_SETTINGS[image.key] && (
                <p className="text-xs text-emerald-600" role="status">
                  Fotografía lista. Guarda la configuración para publicarla.
                </p>
              )}
            </div>
          ))}
        </div>
        {homepageImageError && <p className="text-sm text-[var(--color-danger)]" role="alert">{homepageImageError}</p>}
      </Section>

      <Section title="Política de privacidad">
        <p className="text-sm text-[var(--color-text-muted)]">
          También puedes editar y publicar el aviso desde la opción Privacidad del menú. Verifica que el contenido refleje las prácticas reales del negocio y solicita revisión profesional.
        </p>
        <Field settings={settings} onChange={handleChange} label="Responsable del tratamiento" k="privacyResponsibleName" placeholder="Nombre o razón social" />
        <Field settings={settings} onChange={handleChange} label="Domicilio para privacidad" k="privacyAddress" placeholder="Domicilio completo" />
        <Field settings={settings} onChange={handleChange} label="Correo para solicitudes ARCO" k="privacyEmail" type="email" placeholder="privacidad@negocio.mx" />
        <Field settings={settings} onChange={handleChange} label="Teléfono de privacidad" k="privacyPhone" placeholder="Teléfono de contacto" />
        <Field settings={settings} onChange={handleChange} label="Plazos/criterios de conservación" k="privacyRetention" placeholder="Completar y revisar con asesoría legal" />
        <Field settings={settings} onChange={handleChange} label="Versión del aviso" k="privacyPolicyVersion" placeholder="Ej. 2026-11-07-v1" />
        <label className="block text-xs font-600 text-[var(--color-text)]">
          Contenido adicional aprobado por el negocio
          <textarea className="input-field mt-1 min-h-32 text-sm" value={settings.privacyPolicyText || ""}
            onChange={(event) => handleChange("privacyPolicyText", event.target.value)}
            placeholder="Agrega información específica del negocio solo después de validarla con asesoría jurídica." />
        </label>
      </Section>

      <Section title="WhatsApp">
        <div className="rounded-2xl border border-[#3D3438] bg-[#171517] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#302326] text-[#E8778A]">
                <QrCode size={21} />
              </div>
              <div>
                <h4 className="font-700 text-white">
                  Conexión de WhatsApp
                </h4>
                <p className="mt-1 max-w-xl text-sm text-white/70">
                  Vincula el WhatsApp del negocio para administrar desde aquí
                  los mensajes y recordatorios de citas.
                </p>
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-600 ${
                whatsappStatus.state === "connected"
                  ? "bg-emerald-50 text-emerald-700"
                  : whatsappStatus.state === "error" ||
                      whatsappStatus.state === "disconnected"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-700"
              }`}
            >
              {whatsappStatus.state === "connected" ? (
                <CheckCircle2 size={14} />
              ) : whatsappStatus.state === "error" ||
                whatsappStatus.state === "disconnected" ? (
                <AlertCircle size={14} />
              ) : (
                <LoaderCircle size={14} className="animate-spin" />
              )}
              {whatsappStatus.state === "connected"
                ? "Conectado"
                : whatsappStatus.state === "pairing"
                  ? "Vinculación pendiente"
                  : whatsappStatus.state === "error" ||
                      whatsappStatus.state === "disconnected"
                    ? "Sin conexión"
                    : "Conectando"}
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-[#3D3438] bg-[#211E20] p-5 text-center">
            {whatsappStatus.qr ? (
              <>
                {whatsappQrDataUrl ? (
                  <img
                    src={whatsappQrDataUrl}
                    alt="Código QR para vincular WhatsApp"
                    className="h-56 w-56 rounded-xl border border-white/15 bg-white p-2"
                  />
                ) : (
                  <p className="text-sm text-white/70" role="status">
                    Generando código QR…
                  </p>
                )}
                <p className="max-w-md text-sm text-white/75">
                  En tu teléfono abre WhatsApp →{" "}
                  <strong>Dispositivos vinculados</strong> →{" "}
                  <strong>Vincular un dispositivo</strong> y escanea este
                  código.
                </p>
              </>
            ) : (
              <p
                className={`flex items-center gap-2 text-sm ${
                  whatsappStatus.state === "error"
                    ? "text-red-600"
                    : "text-white/75"
                }`}
                role={whatsappStatus.state === "error" ? "alert" : "status"}
              >
                {whatsappStatus.message}
              </p>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-white/55">
            La conexión se mantiene activa mientras este servidor esté
            encendido. El código QR es temporal y solo se muestra a
            administradores.
          </p>
        </div>
      </Section>

      <Section title="Automatizaciones e historial de WhatsApp">
        <p className="text-sm text-[var(--color-text-muted)]">
          Los mensajes solo se marcan como enviados cuando WhatsApp acepta el envío. El historial conserva estado, sucursal, destinatario parcialmente oculto y motivo de error, sin guardar el contenido completo del mensaje.
        </p>
        <label className="block text-xs font-600 text-[var(--color-text)]">
          Anticipación del recordatorio automático (horas)
          <input
            className="input-field mt-1 max-w-xs"
            type="number"
            min={1}
            max={168}
            value={whatsappAutomations.reminderHours ?? 24}
            onChange={(event) => {
              const hours = Number(event.target.value)
              if (Number.isInteger(hours) && hours >= 1 && hours <= 168) {
                updateAutomationSetting("reminderHours", "", hours)
              }
            }}
          />
        </label>
        <div className="space-y-3">
          {(Object.keys(automationLabels) as WhatsAppAutomationKey[]).map((key) => (
            <div key={key} className="rounded-xl border border-[var(--color-border)] p-3">
              <label className="flex items-center justify-between gap-3 text-sm font-600 text-[var(--color-text)]">
                <span>{automationLabels[key]}</span>
                <input
                  type="checkbox"
                  checked={whatsappAutomations.enabled?.[key] ?? true}
                  onChange={(event) => updateAutomationSetting("enabled", key, event.target.checked)}
                />
              </label>
              <textarea
                className="input-field mt-3 min-h-28 text-sm"
                aria-label={`Mensaje: ${automationLabels[key]}`}
                value={whatsappAutomations.templates?.[key] ?? DEFAULT_WHATSAPP_AUTOMATIONS.templates?.[key] ?? ""}
                onChange={(event) => updateAutomationTemplate(key, event.target.value)}
                placeholder="Usa {firstName}, {date} y {time}."
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <h4 className="font-700 text-[var(--color-text)]">Últimos intentos</h4>
          <button type="button" className="btn-secondary" onClick={() => void loadWhatsAppHistory()} disabled={historyLoading}>
            {historyLoading ? <LoaderCircle size={15} className="animate-spin" /> : <History size={15} />}
            Actualizar historial
          </button>
        </div>
        {historyError && <p className="text-sm text-red-600" role="alert">{historyError}</p>}
        {whatsappHistory.length === 0 && !historyLoading && !historyError && (
          <p className="text-sm text-[var(--color-text-muted)]">Aún no hay intentos registrados.</p>
        )}
        <div className="space-y-2">
          {whatsappHistory.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--color-border)] p-3 text-xs">
              <div>
                <div className="font-600 text-[var(--color-text)]">
                  {automationLabels[entry.stage as WhatsAppAutomationKey] ?? entry.stage}
                  {" · "}{BRANCH_LABEL[entry.branchId]}
                </div>
                <div className="text-[var(--color-text-muted)]">
                  {entry.recipientMasked || "Destinatario sin teléfono"} · Cita {entry.appointmentId || "sin folio"}
                </div>
                {entry.error && <div className="mt-1 text-red-600">{entry.error}</div>}
              </div>
              <div className="text-right">
                <span className={entry.status === "sent" ? "text-emerald-700" : entry.status === "failed" ? "text-red-600" : "text-amber-700"}>
                  {entry.status === "sent" ? "Aceptado por WhatsApp" : entry.status === "failed" ? "Fallido" : "Pendiente"}
                </span>
                <div className="text-[var(--color-text-muted)]">
                  {entry.createdAt ? new Date(entry.createdAt).toLocaleString("es-MX") : "Fecha no disponible"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Cuentas del equipo">
        <p className="text-sm text-[#6B5A5E]">
          Crea cuentas con permisos de administrador o trabajadora.
        </p>
        <input
          className="input-field text-sm"
          placeholder="Nombre completo"
          value={account.name}
          onChange={(e) =>
            setAccount((current) => ({ ...current, name: e.target.value }))
          }
        />
        <input
          className="input-field text-sm"
          type="email"
          placeholder="Correo electrónico"
          value={account.email}
          onChange={(e) =>
            setAccount((current) => ({ ...current, email: e.target.value }))
          }
        />
        <input
          className="input-field text-sm"
          placeholder="Teléfono"
          value={account.phone}
          onChange={(e) =>
            setAccount((current) => ({ ...current, phone: e.target.value }))
          }
        />
        <input
          className="input-field text-sm"
          type="password"
          placeholder="Contraseña (mínimo 6 caracteres)"
          value={account.password}
          onChange={(e) =>
            setAccount((current) => ({ ...current, password: e.target.value }))
          }
        />
        <select
          className="input-field text-sm"
          value={account.role}
          onChange={(e) =>
            setAccount((current) => ({
              ...current,
              role: e.target.value as "admin" | "branchAdmin" | "worker",
            }))
          }
        >
          <option value="worker">Trabajadora</option>
          <option value="branchAdmin">Administradora de sucursal</option>
          <option value="admin">Administrador general</option>
        </select>
        {(account.role === "branchAdmin" || account.role === "worker") && (
          <select
            className="input-field text-sm"
            value={account.branchId}
            onChange={(e) => setAccount((current) => ({ ...current, branchId: e.target.value as BranchId }))}
            aria-label="Sucursal asignada"
          >
            <option value="main">{BRANCH_LABEL.main}</option>
            <option value="north">{BRANCH_LABEL.north}</option>
          </select>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={editingUid ? saveAccount : createAccount}
          >
            {editingUid ? "Guardar cambios" : "Crear cuenta"}
          </button>
          {editingUid && (
            <button
              className="btn-secondary"
              onClick={() => {
                setEditingUid(null)
                setAccount({
                  name: "",
                  email: "",
                  phone: "",
                  password: "",
                  role: "worker",
                  branchId: "main",
                })
              }}
            >
              Cancelar edición
            </button>
          )}
        </div>
        {accountMessage && (
          <p className="text-sm text-emerald-600">{accountMessage}</p>
        )}
        {accountError && <p className="text-sm text-red-500">{accountError}</p>}
        <div className="border-t border-[#F5EDE6] pt-4 space-y-2">
          {users
            .filter((item) => item.role === "admin" || item.role === "branchAdmin" || item.role === "worker")
            .map((item) => (
              <div
                key={item.uid}
                className="flex flex-wrap items-center gap-3 justify-between text-sm border border-[#F5EDE6] rounded-lg p-3"
              >
                <div className="min-w-0">
                  <div className="font-600 text-[#1A1012] truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-[#6B5A5E] truncate">
                    {item.email}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B5A5E]">
                    {item.role === "admin" ? "Administrador general" : item.role === "branchAdmin" ? `Admin. ${BRANCH_LABEL[item.branchId ?? "main"]}` : "Trabajadora"}
                  </span>
                  <button
                    className="btn-ghost p-1.5"
                    title="Editar cuenta"
                    onClick={() => editAccount(item)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn-ghost p-1.5 text-red-500"
                    title="Eliminar perfil"
                    onClick={() => removeAccount(item)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={handleSave} disabled={saving || preparingHomepageImage !== null}>
          <Save size={16} /> {saving ? "Guardando..." : "Guardar configuración"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Guardado</span>}
        {saveError && (
          <span className="text-sm text-red-500" role="alert">
            {saveError}
          </span>
        )}
      </div>
    </div>
  )
}
