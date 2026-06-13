import { apiRequest } from '@/api/client';

export type DocKind = 'report' | 'prescription' | 'other';

export type MedicalDocument = {
  id: string;
  patient_id: string;
  appointment_id?: string;
  kind: DocKind;
  title: string;
  original_name?: string;
  mime: string;
  size?: number;
  created_at?: string;
};

export async function uploadDocument(input: {
  patientId: string;
  appointmentId?: string;
  kind: DocKind;
  title: string;
  originalName?: string;
  mime: string;
  dataBase64: string;
  size?: number;
}): Promise<MedicalDocument> {
  const res = await apiRequest<{ document?: MedicalDocument; data?: MedicalDocument }>('/api/v1/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return (res.document || res.data) as MedicalDocument;
}

export async function listDocuments(patientId: string): Promise<MedicalDocument[]> {
  const res = await apiRequest<{ documents?: MedicalDocument[]; data?: MedicalDocument[] }>(
    `/api/v1/documents?patient_id=${encodeURIComponent(patientId)}`,
  );
  return res.documents || res.data || [];
}
