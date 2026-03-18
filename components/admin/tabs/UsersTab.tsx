"use client";

import React from "react";
import type {
  ManagedUser,
  UserEntitlementLab,
  UserActivitySummary,
  UserActivityItem,
} from "../types";

interface UsersTabProps {
  userSearch: string;
  setUserSearch: (value: string) => void;
  managedUsers: ManagedUser[];
  selectedManagedUserId: string | null;
  setSelectedManagedUserId: (id: string | null) => void;
  selectedManagedUser: ManagedUser | null;
  userMgmtMsg: string;
  entitlementLabs: UserEntitlementLab[];
  activitySummary: UserActivitySummary | null;
  activityItems: UserActivityItem[];
  toggleUserLabAccess: (labId: string, grant: boolean) => Promise<void>;
  setUserMgmtRefreshTick: React.Dispatch<React.SetStateAction<number>>;
}

export default function UsersTab({
  userSearch,
  setUserSearch,
  managedUsers,
  selectedManagedUserId,
  setSelectedManagedUserId,
  selectedManagedUser,
  userMgmtMsg,
  entitlementLabs,
  activitySummary,
  activityItems,
  toggleUserLabAccess,
  setUserMgmtRefreshTick,
}: UsersTabProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ast-sky)]/28 bg-[linear-gradient(160deg,rgba(8,20,52,0.88),rgba(4,12,32,0.95))] shadow-[0_24px_48px_rgba(1,5,18,0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(10,86,198,0.9),transparent)]">
      <div className="border-b border-[var(--ui-primary)]/22 bg-[rgba(10,86,198,0.13)] px-6 py-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--ast-sky-text)]">Módulo 05</p>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-black tracking-tight text-[var(--ui-text)]">
          Gestión de Usuarios
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ast-sky)]/70">Busca usuarios, gestiona accesos y revisa actividad.</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Search bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]/70">Buscar por correo</label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="usuario@correo.com"
              className="w-full rounded-lg border border-[var(--ast-sky)]/18 bg-[rgba(3,10,27,0.82)] px-3 py-2.5 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]/40 focus:border-[var(--ast-sky)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--ui-primary)]/16"
            />
          </div>
          <button
            type="button"
            onClick={() => setUserMgmtRefreshTick((prev) => prev + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ui-border)]/35 bg-[rgba(255,255,255,0.04)] px-4 py-2.5 text-[11px] font-semibold text-[var(--ui-muted)] transition hover:border-[var(--ast-sky)]/35 hover:text-[var(--ui-text)]"
          >
            ↻ Refrescar
          </button>
          {userMgmtMsg && (
            <p className="text-[12px] font-medium text-[var(--ast-yellow)]">◈ {userMgmtMsg}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* User list */}
          <div className="rounded-xl border border-[var(--ast-sky)]/14 bg-[rgba(3,10,27,0.5)] p-3">
            <p className="mb-2.5 px-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--ui-muted)]/55">{managedUsers.length} usuarios</p>
            <div className="max-h-[420px] space-y-1.5 overflow-auto pr-0.5 [scrollbar-width:thin]">
              {managedUsers.map((managedUser) => (
                <button
                  key={managedUser.id}
                  type="button"
                  onClick={() => setSelectedManagedUserId(managedUser.id)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${
                    selectedManagedUserId === managedUser.id
                      ? "border-[var(--ast-sky)]/45 bg-[rgba(10,86,198,0.2)] shadow-[0_0_14px_rgba(10,86,198,0.18)]"
                      : "border-[var(--ast-sky)]/10 bg-transparent hover:border-[var(--ast-sky)]/22 hover:bg-[rgba(10,86,198,0.07)]"
                  }`}
                >
                  <p className="truncate text-[12px] font-semibold text-[var(--ui-text)]">
                    {managedUser.email ?? "Sin correo"}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-geist-mono)] text-[10px] text-[var(--ui-muted)]/65">
                    {managedUser.role} · {managedUser.active_labs} labs
                  </p>
                </button>
              ))}
              {managedUsers.length === 0 && (
                <p className="px-1 py-4 text-center text-[11px] text-[var(--ui-muted)]/50">Sin usuarios.</p>
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="space-y-4">
            {!selectedManagedUserId ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--ast-sky)]/18 text-sm text-[var(--ui-muted)]/50">
                Selecciona un usuario para gestionar.
              </div>
            ) : (
              <>
                {/* User info */}
                <div className="rounded-xl border border-[var(--ast-sky)]/14 bg-[rgba(3,10,27,0.55)] p-4">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--ast-sky)]/60">Información del usuario</p>
                  <div className="grid grid-cols-1 gap-2 text-[12px] md:grid-cols-2">
                    {[
                      { label: "Correo", value: selectedManagedUser?.email ?? "Sin correo" },
                      { label: "Rol", value: selectedManagedUser?.role ?? "student" },
                      { label: "Creado", value: selectedManagedUser?.created_at ? new Date(selectedManagedUser.created_at).toLocaleString() : "N/D" },
                      { label: "Último login", value: selectedManagedUser?.last_sign_in_at ? new Date(selectedManagedUser.last_sign_in_at).toLocaleString() : "N/D" },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-[var(--ast-sky)]/10 bg-[rgba(10,86,198,0.05)] px-3 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-muted)]/55">{label}</p>
                        <p className="mt-0.5 font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--ui-text)]/85 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Labs activos", value: entitlementLabs.filter((l) => l.hasAccess).length },
                    { label: "Progresos", value: activitySummary?.progress_count ?? 0 },
                    { label: "Comentarios", value: activitySummary?.comments_count ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-[var(--ast-sky)]/14 bg-[rgba(3,10,27,0.55)] p-4 text-center">
                      <p className="font-[family-name:var(--font-space-grotesk)] text-3xl font-black text-[var(--ast-sky)]">{value}</p>
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-muted)]/60">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Lab access */}
                <div className="rounded-xl border border-[var(--ast-sky)]/14 bg-[rgba(3,10,27,0.55)] p-4">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--ast-sky)]/60">Accesos a Labs</p>
                  <div className="max-h-52 space-y-1.5 overflow-auto pr-0.5 [scrollbar-width:thin]">
                    {entitlementLabs.map((lab) => (
                      <div
                        key={lab.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ast-sky)]/10 bg-[rgba(10,86,198,0.04)] px-3 py-2"
                      >
                        <div>
                          <p className="text-[12px] font-medium text-[var(--ui-text)]">{lab.title}</p>
                          <p className="font-[family-name:var(--font-geist-mono)] text-[9px] text-[var(--ui-muted)]/55 uppercase tracking-wider">{lab.status}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleUserLabAccess(lab.id, !lab.hasAccess)}
                          className={`rounded-md border px-2.5 py-1 text-[10px] font-bold transition ${
                            lab.hasAccess
                              ? "border-[var(--ast-rust)]/30 bg-[rgba(136,31,0,0.12)] text-[var(--ast-coral)] hover:bg-[rgba(136,31,0,0.22)]"
                              : "border-[var(--ast-mint)]/35 bg-[rgba(4,164,90,0.1)] text-[var(--ast-mint)] hover:bg-[rgba(4,164,90,0.2)]"
                          }`}
                        >
                          {lab.hasAccess ? "Revocar" : "Conceder"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div className="rounded-xl border border-[var(--ast-sky)]/14 bg-[rgba(3,10,27,0.55)] p-4">
                  <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--ast-sky)]/60">Actividad reciente</p>
                  <div className="max-h-52 space-y-2 overflow-auto pr-0.5 [scrollbar-width:thin]">
                    {activityItems.map((item, index) => (
                      <div
                        key={`${item.type}-${item.lab_id}-${item.day_number ?? 0}-${index}`}
                        className="rounded-lg border border-[var(--ast-sky)]/10 bg-[rgba(10,86,198,0.04)] px-3 py-2.5"
                      >
                        <p className="font-[family-name:var(--font-geist-mono)] text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--ui-muted)]/60">
                          {item.type === "comment" ? "Comentario" : "Progreso"}
                          <span className="mx-1.5 text-[var(--ui-border)]">·</span>
                          {item.lab_title}
                          <span className="mx-1.5 text-[var(--ui-border)]">·</span>
                          Día {item.day_number ?? "-"}
                        </p>
                        {item.content && (
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-[var(--ui-text)]/75">{item.content}</p>
                        )}
                        {item.created_at && (
                          <p className="mt-1 text-[9px] text-[var(--ui-muted)]/45">{new Date(item.created_at).toLocaleString()}</p>
                        )}
                      </div>
                    ))}
                    {activityItems.length === 0 && (
                      <p className="py-3 text-center text-[11px] text-[var(--ui-muted)]/50">Sin actividad registrada.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
