import { apiRequest } from '@/integrations/mongodb/client';

export type MedicalDocument = {
  id: string;
  patient_id: string;
  appointment_id?: string;
  doctor_id?: string;
  kind: 'report' | 'prescription' | 'other';
  title: string;
  original_name?: string;
  mime: string;
  size?: number;
  created_at?: string;
  data?: string;
};

export async function listMedicalDocuments(patientId: string) {
  const response = await apiRequest<{ documents?: MedicalDocument[]; data?: MedicalDocument[] }>(
    `/api/v1/documents?patient_id=${encodeURIComponent(patientId)}&limit=100`,
  );
  return response.documents || response.data || [];
}

export async function openMedicalDocument(documentId: string) {
  const preview = window.open('', '_blank');
  if (preview) {
    preview.opener = null;
    preview.document.title = 'Loading document';
    preview.document.body.textContent = 'Loading document...';
  }

  try {
    const response = await apiRequest<{ document?: MedicalDocument; data?: MedicalDocument }>(
      `/api/v1/documents/${encodeURIComponent(documentId)}`,
    );
    const document = response.document || response.data;
    if (!document?.data) throw new Error('Document data is unavailable');

    const binary = window.atob(document.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: document.mime }));

    if (preview) {
      preview.location.href = url;
    } else {
      const link = window.document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    preview?.close();
    throw error;
  }
}
