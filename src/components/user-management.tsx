"use client";

import { useMemo, useState } from "react";
import type { AuthRole, ManagedUser } from "@/types/auth";
import styles from "@/app/admin/users/users.module.css";

const roleLabels: Record<AuthRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operator: "Operario",
};

export function UserManagement({ initialUsers, currentUserId }: { initialUsers: ManagedUser[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const totals = useMemo(() => ({
    total: users.length,
    pending: users.filter((user) => !user.isActive).length,
    active: users.filter((user) => user.isActive).length,
  }), [users]);

  function updateLocal(id: string, patch: Partial<ManagedUser>) {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user));
  }

  return (
    <>
      <section className={styles.summary}>
        <article><span>Total de usuarios</span><strong>{totals.total}</strong></article>
        <article><span>Pendientes</span><strong>{totals.pending}</strong></article>
        <article><span>Activos</span><strong>{totals.active}</strong></article>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeader}><span>USUARIO</span><span>ESTADO</span><span>ROL</span><span>ACCESO</span><span>ACCIÓN</span></div>
        {users.map((user) => <UserRow key={user.id} user={user} isCurrent={user.id === currentUserId} onChange={updateLocal} />)}
      </section>
    </>
  );
}

function UserRow({ user, isCurrent, onChange }: { user: ManagedUser; isCurrent: boolean; onChange: (id: string, patch: Partial<ManagedUser>) => void }) {
  const [role, setRole] = useState<AuthRole | null>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function save() {
    if (isActive && !role) {
      setMessage("Asigná un rol antes de activar la cuenta.");
      setIsError(true);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo guardar el usuario.");
      onChange(user.id, { role, isActive });
      setIsError(false);
      setMessage("Cambios guardados.");
    } catch (caught) {
      setIsError(true);
      setMessage(caught instanceof Error ? caught.message : "No se pudo guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.userRow}>
      <div className={styles.identity}><strong>{user.displayName}{isCurrent ? " (vos)" : ""}</strong><small>@{user.username} · Solicitud {new Intl.DateTimeFormat("es-AR").format(new Date(user.createdAt))}</small></div>
      <span className={`${styles.status} ${user.isActive ? styles.statusActive : ""}`}>{user.isActive ? "Activo" : "Pendiente"}</span>
      <select value={role ?? ""} onChange={(event) => setRole((event.target.value || null) as AuthRole | null)} disabled={isCurrent} aria-label={`Rol de ${user.displayName}`}>
        <option value="">Sin rol</option>
        {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className={styles.toggle}><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} disabled={isCurrent} />Activar</label>
      <button className={styles.save} onClick={save} disabled={isCurrent || saving}>{saving ? "Guardando..." : isCurrent ? "Protegido" : "Guardar"}</button>
      {message && <p className={`${styles.message} ${isError ? styles.messageError : ""}`}>{message}</p>}
    </div>
  );
}
