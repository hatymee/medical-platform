"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("medical_role") !== "doctor") router.replace("/connexion");
  }, [router]);

  return <>{children}</>;
}