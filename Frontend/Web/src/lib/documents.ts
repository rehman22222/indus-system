// Patient medical-document upload for the web portal — mirrors the mobile
// `@/api/documents` contract so reports / past prescriptions attached while
// booking land in the same `/api/v1/documents` store the doctor portal reads.

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

export type DocKind = 'report' | 'prescription' | 'other';

export type UploadDocumentInput = {
  patientId: string;
  appointmentId?: string;
  kind: DocKind;
  title: string;
  originalName?: string;
  mime: string;
  dataBase64: string;
  size?: number;
};

function authToken(): string | null {
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

/** Read a browser File into a bare base64 string (no `data:...;base64,` prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPatientDocument(input: UploadDocumentInput): Promise<void> {
  const token = authToken();
  const response = await fetch(`${API_BASE_URL}/api/v1/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || body?.error || `Upload failed (${response.status})`);
  }
}
