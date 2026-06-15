import { apiRequest } from '@/api/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  data?: string;
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

export async function getDocument(documentId: string): Promise<MedicalDocument> {
  const res = await apiRequest<{ document?: MedicalDocument; data?: MedicalDocument }>(`/api/v1/documents/${documentId}`);
  return (res.document || res.data) as MedicalDocument;
}

export async function openDocument(documentId: string): Promise<void> {
  const document = await getDocument(documentId);
  if (!document.data) throw new Error('The document file is unavailable.');
  if (!FileSystem.cacheDirectory) throw new Error('Device storage is unavailable.');
  const extension = document.mime === 'application/pdf' ? 'pdf' : document.mime.split('/')[1] || 'bin';
  const safeName = (document.original_name || document.title || `document-${document.id}`)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.[^.]+$/, '');
  const fileUri = `${FileSystem.cacheDirectory}${safeName}.${extension}`;
  await FileSystem.writeAsStringAsync(fileUri, document.data, { encoding: FileSystem.EncodingType.Base64 });
  if (!await Sharing.isAvailableAsync()) throw new Error('Document preview is unavailable on this device.');
  await Sharing.shareAsync(fileUri, { mimeType: document.mime, dialogTitle: document.original_name || document.title });
}
