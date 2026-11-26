"use client";

import { Activity, Boxes, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import type { AuthUser } from "@/types/auth";
import styles from "./app-navigation.module.css";

const roleLabels = { admin: "Administrador", supervisor: "Supervisor", operator: "Operario" };

const screenTitles = { summary: "Resumen", lots: "Lotes", users: "Usuarios" };

export function AppNavigation({ user, current, dateLabel, databaseConnected }: {
  user: Pick<AuthUser, "displayName" | "role">;
  current: keyof typeof screenTitles;
  dateLabel: string;
  databaseConnected: boolean;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0)).join("").toUpperCase();
  const close = () => drawer.current?.close();

  return (
    <>
      <header className={styles.topbar}>
        <button type="button" className={styles.menuButton} aria-label="Abrir menú"
          aria-haspopup="dialog" aria-controls="cadena-menu" onClick={() => drawer.current?.showModal()}>
          <Menu size={22} aria-hidden="true" />
        </button>
        <h1 className={styles.heading}>{screenTitles[current]}</h1>
        <p className={styles.date}>{dateLabel}</p>
      </header>
      <dialog ref={drawer} id="cadena-menu" className={styles.drawer}
        aria-labelledby="cadena-menu-title"
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className={styles.drawerContent}>
          <div className={styles.brand}>
            <div><strong id="cadena-menu-title">CADENA</strong><small>Control de producción</small></div>
            <button type="button" className={styles.iconButton} onClick={close} aria-label="Cerrar menú" autoFocus>
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <nav className={styles.nav} aria-label="Navegación principal">
            <Link href="/" aria-current={current === "summary" ? "page" : undefined} onClick={close}>
              <LayoutDashboard size={18} aria-hidden="true" />Resumen
            </Link>
            <Link href="/lotes" aria-current={current === "lots" ? "page" : undefined} onClick={close}>
              <Boxes size={18} aria-hidden="true" />Lotes
            </Link>
            <Link href="/#procesos" onClick={close}><Activity size={18} aria-hidden="true" />Procesos</Link>
            {user.role === "admin" && (
              <>
                <p>ADMINISTRACIÓN</p>
                <Link href="/admin/users" prefetch={false} aria-current={current === "users" ? "page" : undefined} onClick={close}>
                  <Users size={18} aria-hidden="true" />Usuarios
                </Link>
              </>
            )}
          </nav>
          <p className={styles.databaseStatus} data-connected={databaseConnected}>
            {databaseConnected ? "MySQL conectado" : "MySQL sin conexión"}
          </p>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{initials}</span>
            <div><strong>{user.displayName}</strong><small>{roleLabels[user.role]}</small></div>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className={styles.iconButton} title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
