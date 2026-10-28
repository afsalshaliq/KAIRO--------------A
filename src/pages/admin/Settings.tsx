import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { updateSchool } from "@/services/tenant";
import { getSchoolAIConfig, updateSchoolAIConfig } from "@/services/aiAssistant";
import { useToast } from "@/components/ui";

// Curated school crest and badge presets
const PRESET_SCHOOL_LOGOS = [
  {
    name: "Royal Shield",
    badge: "Academy Crest",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e3a8a"/><stop offset="100%" stop-color="%233b82f6"/></linearGradient></defs><path d="M50 5 L85 20 V50 C85 75 50 95 50 95 C50 95 15 75 15 50 V20 Z" fill="url(%23rg)" stroke="%23fbbf24" stroke-width="4"/><path d="M35 45 L50 30 L65 45 L60 65 L40 65 Z" fill="%23fbbf24"/><circle cx="50" cy="50" r="5" fill="%23ffffff"/></svg>`,
  },
  {
    name: "Oxford Emblem",
    badge: "Heritage",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23065f46"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect x="15" y="15" width="70" height="70" rx="16" fill="url(%23og)" stroke="%2334d399" stroke-width="3"/><path d="M30 40 Q50 30 50 70 Q50 30 70 40" stroke="%23ffffff" stroke-width="5" fill="none"/><line x1="50" y1="30" x2="50" y2="70" stroke="%23ffffff" stroke-width="4"/></svg>`,
  },
  {
    name: "Beacon of Wisdom",
    badge: "Inspiration",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%237c3aed"/><stop offset="100%" stop-color="%23ec4899"/></linearGradient></defs><circle cx="50" cy="50" r="42" fill="url(%23wg)"/><path d="M50 20 Q65 40 50 60 Q35 40 50 20 Z" fill="%23fbbf24"/><polygon points="45,60 55,60 52,80 48,80" fill="%23ffffff"/></svg>`,
  },
  {
    name: "Laurel Scholar",
    badge: "Excellence",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><circle cx="50" cy="48" r="40" fill="url(%23lg)" stroke="%234338ca" stroke-width="4"/><polygon points="50,22 58,38 76,38 62,50 67,68 50,56 33,68 38,50 24,38 42,38" fill="%23ffffff"/></svg>`,
  },
];

export default function Settings() {
  const { profile, configured } = useAuth();
  const { school, refreshTenant } = useTenant();
  const toast = useToast();

  // Editable settings
  const [schoolName, setSchoolName] = useState(school?.name || "");
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || "");
  const [primaryColor, setPrimaryColor] = useState(school?.primary_color || "#2563eb");
  const [secondaryColor, setSecondaryColor] = useState(school?.secondary_color || "#0d9488");

  // Feature Flags
  const [aiEnabled, setAiEnabled] = useState(school?.settings?.ai_enabled ?? true);
  const [faceAuthEnabled, setFaceAuthEnabled] = useState(school?.settings?.face_auth_enabled ?? true);
  const [teacherAdminEnabled, setTeacherAdminEnabled] = useState(school?.settings?.teacher_admin_enabled ?? true);

  // AI Config
  const [allowTeacherKeys, setAllowTeacherKeys] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (school) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSchoolName(school.name);
      setLogoUrl(school.logo_url || "");
      setPrimaryColor(school.primary_color || "#2563eb");
      setSecondaryColor(school.secondary_color || "#0d9488");
      setAiEnabled(school.settings?.ai_enabled ?? true);
      setFaceAuthEnabled(school.settings?.face_auth_enabled ?? true);
      setTeacherAdminEnabled(school.settings?.teacher_admin_enabled ?? true);
      /* eslint-enable react-hooks/set-state-in-effect */

      getSchoolAIConfig(school.id).then((cfg) => {
        if (cfg) {
          setAllowTeacherKeys(cfg.allow_teacher_keys);
        }
      });
    }
  }, [school]);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("error", "Logo file size must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result);
        toast("info", "School logo loaded. Click 'Save School Settings' to persist.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefaultLogo = () => {
    setLogoUrl("");
    toast("info", "Reset to default KAIRO logo. Click 'Save School Settings' to persist.");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    setSaving(true);
    try {
      // 1. Update school settings (including logo_url)
      await updateSchool(school.id, {
        name: schoolName,
        logo_url: logoUrl.trim() || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        settings: {
          ai_enabled: aiEnabled,
          face_auth_enabled: faceAuthEnabled,
          teacher_admin_enabled: teacherAdminEnabled,
        },
      });

      // 2. Update AI config
      await updateSchoolAIConfig(school.id, {
        allow_teacher_keys: allowTeacherKeys,
      });

      await refreshTenant();
      // Broadcast change so UI header & sidebar refresh reactively
      window.dispatchEvent(new Event("kairo_logo_changed"));
      toast("success", "School settings & branding updated successfully.");
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="School Settings & Branding"
        subtitle={`Configure branding, AI policies, and feature flags for ${school?.name || "your school"}.`}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* School Tenant Branding & Logo */}
          <div className="card p-6 space-y-4 border-border">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-fg">
                Institution Branding & Crest
              </h2>
              <span className={`badge text-[10px] font-bold ${logoUrl ? "bg-accent-soft text-accent border border-accent/20" : "bg-surface text-muted border border-border"}`}>
                {logoUrl ? "Custom School Crest Active" : "Default Kairo Logo Active"}
              </span>
            </div>

            {/* Live Logo Preview Box */}
            <div className="p-4 rounded-xl border border-border bg-surface/50 flex flex-col sm:flex-row items-center gap-4">
              <div
                style={{ backgroundColor: primaryColor }}
                className="h-16 w-16 rounded-2xl flex items-center justify-center p-2.5 shadow-sm shrink-0 border border-white/20 transition-all"
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="School Logo Preview"
                    className="h-full w-full object-contain rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo.svg";
                    }}
                  />
                ) : (
                  <img
                    src="/logo.svg"
                    alt="KAIRO Default Logo"
                    className="h-full w-full object-contain brightness-0 invert"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h3 className="font-bold text-sm text-fg truncate">{schoolName || "School Name"}</h3>
                  {logoUrl && (
                    <span className="badge bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                      Custom Logo
                    </span>
                  )}
                  {!logoUrl && (
                    <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      Kairo Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {logoUrl
                    ? "Custom logo active across school portal, worksheets, and reports."
                    : "Defaulting to official KAIRO platform emblem. You can upload your own below."}
                </p>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleResetToDefaultLogo}
                    className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 mx-auto sm:mx-0"
                  >
                    <span>↺</span> Reset to Default Kairo Logo
                  </button>
                )}
              </div>
            </div>

            {/* Preset Crest Selectors */}
            <div>
              <label className="label">Preset Institutional Crests</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_SCHOOL_LOGOS.map((preset) => {
                  const isSelected = logoUrl === preset.url;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setLogoUrl(preset.url);
                        toast("info", `Selected preset: ${preset.name}`);
                      }}
                      className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition text-center ${
                        isSelected
                          ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                          : "border-border bg-surface hover:bg-surface/80"
                      }`}
                    >
                      <div className="h-9 w-9 flex items-center justify-center p-1 rounded-lg bg-white border border-border/60 shadow-xs">
                        <img src={preset.url} alt={preset.name} className="h-full w-full object-contain" />
                      </div>
                      <span className="text-[11px] font-bold text-fg truncate w-full">{preset.name}</span>
                      <span className="text-[9px] text-muted">{preset.badge}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Logo URL & File Upload */}
            <div className="space-y-2 pt-1">
              <label className="label">Custom Logo Image (URL or Upload File)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://... or choose file on right"
                  value={logoUrl.startsWith("data:") ? "(Custom Uploaded Image Data)" : logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="input flex-1 text-xs"
                />
                <label className="btn-outline text-xs px-3 py-2 cursor-pointer shrink-0 border-border hover:bg-surface">
                  <span>📁 Upload Image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted">
                Accepts PNG, JPG, WebP, or SVG (max 2MB). Leave empty to use default KAIRO logo.
              </p>
            </div>

            <div>
              <label className="label">Institution Display Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="input"
                required
              />
            </div>

            <div className="flex justify-between items-center text-xs text-muted py-2 px-3 rounded-xl bg-surface border border-border">
              <span className="font-medium">Assigned Subdomain:</span>
              <span className="font-mono text-accent font-semibold">{school?.slug}.kairo.com</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="label">Primary Brand Color</label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <span className="text-xs font-mono text-muted">{primaryColor}</span>
                </div>
              </div>
              <div>
                <label className="label">Secondary Accent</label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <span className="text-xs font-mono text-muted">{secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="card p-6 space-y-4 border-border">
            <h2 className="font-bold text-base text-fg">
              School Feature Flags
            </h2>
            <p className="text-xs text-muted">
              Control active capabilities for teaching staff. Database and server authorization enforce these flags.
            </p>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-surface/60 border border-border cursor-pointer hover:bg-surface transition-colors select-none">
                <div>
                  <span className="font-bold text-sm text-fg block">Pedagogical AI Assistant</span>
                  <span className="text-xs text-muted">Enable lesson preparation AI assistant for teaching staff</span>
                </div>
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-surface/60 border border-border cursor-pointer hover:bg-surface transition-colors select-none">
                <div>
                  <span className="font-bold text-sm text-fg block">Biometric Face Authentication</span>
                  <span className="text-xs text-muted">Allow face verification for Teacher Admin elevation workflows</span>
                </div>
                <input
                  type="checkbox"
                  checked={faceAuthEnabled}
                  onChange={(e) => setFaceAuthEnabled(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-surface/60 border border-border cursor-pointer hover:bg-surface transition-colors select-none">
                <div>
                  <span className="font-bold text-sm text-fg block">Teacher Admin Delegation</span>
                  <span className="text-xs text-muted">Enable teacher elevation petitions and delegated permissions</span>
                </div>
                <input
                  type="checkbox"
                  checked={teacherAdminEnabled}
                  onChange={(e) => setTeacherAdminEnabled(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* AI Policy & Configuration */}
          <div className="card p-6 space-y-4 border-border">
            <h2 className="font-bold text-base text-fg">
              AI Configuration & Model Scoping
            </h2>
            <p className="text-xs text-muted">
              Model parameters and access constraints. API credentials are stored server-side and never shipped in the client bundle.
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-surface border border-border">
                <span className="text-muted font-medium">Default Grounding Engine:</span>
                <span className="font-mono text-accent font-semibold">Grounded Textbook Retrieval</span>
              </div>

              <label className="flex items-center justify-between p-3.5 rounded-xl bg-surface/60 border border-border cursor-pointer hover:bg-surface transition-colors select-none">
                <div>
                  <span className="font-bold text-sm text-fg block">Allow Faculty API Key Overrides</span>
                  <span className="text-xs text-muted">Allow individual teachers to supply custom API credentials</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowTeacherKeys}
                  onChange={(e) => setAllowTeacherKeys(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Administrator Info & Security */}
          <div className="card p-6 space-y-3 border-border">
            <h2 className="font-bold text-base text-fg">
              Security Realm & Governance
            </h2>
            <div className="space-y-2.5 text-xs text-muted bg-surface/50 p-4 rounded-xl border border-border">
              <div className="flex justify-between">
                <span>Active Principal:</span>
                <span className="font-bold text-fg">{profile?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Principal Email:</span>
                <span className="font-mono text-fg">{profile?.email}</span>
              </div>
              <div className="flex justify-between">
                <span>Database Connection:</span>
                <span className={configured ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                  {configured ? "Supabase Postgres Connected" : "Local Dev Auth Mode"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tenant Isolation Layer:</span>
                <span className="text-emerald-700 font-bold">Active RLS Policy Pinned</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary btn-lg text-sm px-6">
            {saving ? "Saving Changes…" : "Save School Settings"}
          </button>
        </div>
      </form>
    </>
  );
}
