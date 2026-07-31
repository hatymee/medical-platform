"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const role = localStorage.getItem("role");
    const token = localStorage.getItem("token");

    if (!token || role !== "doctor") {
      router.push("/connexion");
    }
  }, [router]);

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  const links = [
    { href: "/doctor/dashboard", label: "Tableau de bord" },
    { href: "/doctor/patients", label: "Mes patients" },
  ];

  return (
    <div className="dashboard">
      <aside className="dashboardSidebar">
        <div className="brand" style={{ marginBottom: "2rem" }}>
          MedLink
        </div>

        <nav>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button onClick={logout} className="logoutBtn" style={{ marginTop: "auto" }}>
          Déconnexion
        </button>
      </aside>

      <main className="dashboardMain">{children}</main>
    </div>
  );
}