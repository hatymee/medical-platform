const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";

export type TokenResponse = { access_token: string; token_type: string; role: string };
export type Patient = { id: string; first_name: string; last_name: string; date_of_birth: string; sex: string | null; blood_group: string; national_id: string | null; address: string | null };
export type Appointment = { id: string; doctor_id: string; patient_id: string; scheduled_at: string; status: string; reason: string | null };
export type Consultation = { id: string; patient_id: string; doctor_id: string; consultation_date: string; reason: string | null; notes: string | null };
export type Prescription = { id: string; consultation_id: string; medication_name: string; dosage: string | null; duration: string | null; instructions: string | null };
export type MedicalDocument = { id: string; category: string; title: string; file_url: string; document_date: string; created_at: string };
export type RevenueSummary = { period_start: string; period_end: string; invoiced_total: number; collected_total: number; outstanding_total: number; invoice_count: number };

export function saveSession(session: TokenResponse) {
  localStorage.setItem("medical_token", session.access_token);
  localStorage.setItem("medical_role", session.role);
}

export function clearSession() {
  localStorage.removeItem("medical_token");
  localStorage.removeItem("medical_role");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("medical_token") : null;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "Une erreur est survenue avec le serveur.");
  }
  return response.json() as Promise<T>;
}
