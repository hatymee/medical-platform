"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clearSession } from "@/lib/api";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => { if (localStorage.getItem("medical_role") !== "doctor") router.replace("/connexion"); }, [router]);
  const links = [{ href: "/doctor/dashboard", label: "Tableau de bord" }, { href: "/doctor/patients", label: "Patients autorisés" }, { href: "/professionnel", label: "Chiffre d’affaires" }];
  return <div className="dashboard"><aside className="dashboardSidebar"><a className="brand" href="/doctor/dashboard">MedLink</a><nav className="dashboardMenu">{links.map((link) => <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>{link.label}</Link>)}</nav><button className="logout" onClick={() => { clearSession(); router.push("/connexion"); }}>Déconnexion</button></aside><main className="dashboardMain">{children}</main></div>;
}
