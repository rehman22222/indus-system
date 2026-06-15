import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Camera,
  ClipboardPenLine,
  ExternalLink,
  FileText,
  Files,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PhoneOff,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { AgoraCall } from '@/components/shared/AgoraCall';

const CONFIGURED_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const API_BASE_URL = (() => {
  try {
    const configured = new URL(CONFIGURED_API_BASE_URL);
    const explicitSignalUrl = import.meta.env.VITE_VIDEO_SIGNAL_URL;
    if (explicitSignalUrl) return explicitSignalUrl.replace(/\/$/, '');
    if (window.location.protocol === 'https:' && configured.protocol === 'http:') {
      return window.location.origin;
    }
    const pageIsOnLan = !['localhost', '127.0.0.1'].includes(window.location.hostname);
    const apiIsLocalhost = ['localhost', '127.0.0.1'].includes(configured.hostname);
    if (pageIsOnLan && apiIsLocalhost) {
      configured.hostname = window.location.hostname;
      return configured.toString().replace(/\/$/, '');
    }
  } catch {
    // The socket connection will surface an actionable connection error.
  }
  return CONFIGURED_API_BASE_URL.replace(/\/$/, '');
})();

type CallToken = { appointmentId: string; role: string };
type Medication = { name: string; dosage: string; frequency: string; duration: string };
type AgoraCredentials = {
  appId: string;
  channel: string;
  token?: string | null;
  uid?: number;
};
type ClinicalContext = {
  role: string;
  appointment: {
    _id?: string;
    id?: string;
    token?: string;
    date?: string;
    time?: string;
    appointment_type?: string;
    video_room_url?: string;
    visit_type?: string;
    chief_complaint?: string;
    history_summary?: string;
    patient_id?: {
      name?: string;
      email?: string;
      phone?: string;
      date_of_birth?: string;
      gender?: string;
      blood_group?: string;
      allergies?: string[];
      medical_history?: unknown;
    };
    doctor_id?: { name?: string; specialty?: string; qualification?: string };
  };
  documents: Array<{
    id: string;
    title?: string;
    original_name?: string;
    kind?: string;
    mime?: string;
    size?: number;
  }>;
  prescription?: {
    diagnosis?: string;
    medications?: Medication[];
    instructions?: string;
    notes?: string;
    follow_up_date?: string;
  } | null;
};

function decodeCallToken(token: string): CallToken | null {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as Partial<CallToken>;
    if (!payload.appointmentId || !payload.role) return null;
    return { appointmentId: String(payload.appointmentId), role: String(payload.role) };
  } catch {
    return null;
  }
}

function formatMedicalHistory(value: unknown) {
  if (!value) return 'None provided';
  if (typeof value === 'string') return value || 'None provided';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None provided';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== '' && item !== false)
      .map(([key, item]) => `${key.replace(/_/g, ' ')}: ${String(item)}`);
    return entries.length ? entries.join('\n') : 'None provided';
  }
  return String(value);
}

function fileSize(bytes = 0) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoCallRoom() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const returnUrl = useMemo(() => {
    const candidate = searchParams.get('returnUrl') || '';
    try {
      const parsed = new URL(candidate);
      return ['indusappointment:', 'exp:', 'exps:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
      return '';
    }
  }, [searchParams]);
  const call = useMemo(() => decodeCallToken(token), [token]);
  const socketRef = useRef<Socket | null>(null);
  const startMediaRef = useRef<(() => void) | null>(null);
  const mediaRequestRef = useRef(false);
  const endedRef = useRef(false);
  const [status, setStatus] = useState('Camera and microphone are off');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);
  const [connected, setConnected] = useState(false);
  const [agoraCredentials, setAgoraCredentials] = useState<AgoraCredentials | null>(null);
  const [ended, setEnded] = useState(false);
  const [declined, setDeclined] = useState<{ reason: string; name: string } | null>(null);
  const [clinical, setClinical] = useState<ClinicalContext | null>(null);
  const [clinicalError, setClinicalError] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<'patient' | 'files' | 'prescription'>('patient');
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<Medication[]>([
    { name: '', dosage: '', frequency: '', duration: '' },
  ]);
  const [instructions, setInstructions] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [prescriptionMessage, setPrescriptionMessage] = useState('');
  const isDoctor = call?.role === 'doctor';
  const displayName = clinical?.appointment?.doctor_id?.name || 'Doctor';

  const returnToPatientApp = useCallback(() => {
    if (returnUrl) window.location.assign(returnUrl);
  }, [returnUrl]);

  const loadClinicalContext = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/video/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Clinical details could not be loaded');
      const next = body as ClinicalContext;
      setClinical(next);
      setClinicalError('');
      if (next.prescription) {
        setDiagnosis(next.prescription.diagnosis || '');
        setMedications(next.prescription.medications?.length
          ? next.prescription.medications
          : [{ name: '', dosage: '', frequency: '', duration: '' }]);
        setInstructions(next.prescription.instructions || '');
        setDoctorNotes(next.prescription.notes || '');
        setFollowUpDate(next.prescription.follow_up_date || '');
      }
    } catch (contextError) {
      setClinicalError(contextError instanceof Error ? contextError.message : 'Clinical details could not be loaded');
    }
  }, [token]);

  const finishCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    socketRef.current?.disconnect();
    socketRef.current = null;
    setAgoraCredentials(null);
    setMediaReady(false);
    setConnected(false);
    setEnded(true);
  }, []);

  useEffect(() => {
    void loadClinicalContext();
  }, [loadClinicalContext]);

  useEffect(() => {
    if (!ended || call?.role !== 'patient' || !returnUrl) return undefined;
    const timer = window.setTimeout(returnToPatientApp, 700);
    return () => window.clearTimeout(timer);
  }, [call?.role, ended, returnToPatientApp, returnUrl]);

  // Doctor only: watch for the patient declining the ring — even before the
  // doctor has tapped "Join consultation". When it arrives we cut the call
  // (camera/mic off) and surface the patient's reason on this tab.
  useEffect(() => {
    if (!isDoctor || !call || !token) return undefined;
    const watcher = io(API_BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    const onDeclined = (payload: { appointmentId?: string; reason?: string; patientName?: string }) => {
      if (payload?.appointmentId && payload.appointmentId !== call.appointmentId) return;
      setDeclined({ reason: payload?.reason || '', name: payload?.patientName || 'The patient' });
      finishCall();
    };
    watcher.on('call:declined', onDeclined);
    return () => {
      watcher.off('call:declined', onDeclined);
      watcher.disconnect();
    };
  }, [isDoctor, call, token, finishCall]);

  useEffect(() => {
    if (!call || !token) {
      setError('This consultation link is invalid or incomplete.');
      return;
    }

    let disposed = false;
    let socket: Socket | null = null;
    const start = async () => {
      if (mediaRequestRef.current || agoraCredentials) return;
      mediaRequestRef.current = true;
      setStarting(true);
      setError('');
      setShowPermissionHelp(false);
      setStatus('Preparing private video consultation...');
      const helpTimer = window.setTimeout(() => setShowPermissionHelp(true), 8000);

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/video/agora-token`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || body.error || 'Could not prepare the Agora call.');
        if (disposed) return;
        setAgoraCredentials(body as AgoraCredentials);

        socket = io(API_BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
        socketRef.current = socket;
        socket.on('connect', () => socket?.emit('video.join', { appointmentId: call.appointmentId }));
        socket.on('video.peer-left', () => {
          setStatus('The other participant left. Waiting for them to rejoin...');
        });
        socket.on('video.ended', finishCall);
        socket.on('prescription.updated', () => { void loadClinicalContext(); });
        socket.on('video.error', ({ message }: { message?: string }) => setError(message || 'Could not join this consultation.'));
        socket.on('connect_error', () => setError('Could not reach the consultation server. Please check your connection.'));
        setMediaReady(true);
        setStarting(false);
        setShowPermissionHelp(false);
        setConnected(true);
        setStatus('Joining private Agora room...');
      } catch (mediaError) {
        mediaRequestRef.current = false;
        setStarting(false);
        const name = mediaError instanceof DOMException ? mediaError.name : '';
        const message = name === 'NotAllowedError'
          ? 'Camera or microphone permission was blocked. Select the lock icon in the address bar, allow both permissions, then try again.'
          : name === 'NotReadableError'
            ? 'The camera is busy or unavailable. Close other camera apps, then try again.'
            : mediaError instanceof Error
              ? mediaError.message
              : 'Camera or microphone access was denied.';
        setError(message);
      } finally {
        window.clearTimeout(helpTimer);
      }
    };

    startMediaRef.current = () => { void start(); };
    return () => {
      disposed = true;
      startMediaRef.current = null;
      if (!endedRef.current) socket?.emit('video.leave');
      socket?.disconnect();
      mediaRequestRef.current = false;
    };
  }, [call, finishCall, loadClinicalContext, token]);

  const enableMedia = () => startMediaRef.current?.();
  const endCall = () => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      finishCall();
      return;
    }
    const fallback = window.setTimeout(finishCall, 1000);
    socket.emit('video.end', {}, () => {
      window.clearTimeout(fallback);
      finishCall();
    });
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    setMedications((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const savePrescription = async () => {
    setSavingPrescription(true);
    setPrescriptionMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/video/prescription`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis,
          medications,
          instructions,
          notes: doctorNotes,
          follow_up_date: followUpDate,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Prescription could not be saved');
      setPrescriptionMessage('Saved to the patient record');
      await loadClinicalContext();
    } catch (saveError) {
      setPrescriptionMessage(saveError instanceof Error ? saveError.message : 'Prescription could not be saved');
    } finally {
      setSavingPrescription(false);
    }
  };

  const openDocument = async (documentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/video/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Document could not be opened');
      const document = body.document || body.data;
      const binary = atob(document.data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const url = URL.createObjectURL(new Blob([bytes], { type: document.mime || 'application/octet-stream' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (documentError) {
      setClinicalError(documentError instanceof Error ? documentError.message : 'Document could not be opened');
    }
  };

  if (ended) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-neutral-950 px-6 text-white">
        <div className="max-w-md text-center">
          {declined ? (
            <>
              <PhoneOff className="mx-auto mb-5 h-12 w-12 text-red-400" />
              <h1 className="text-2xl font-semibold">Call declined</h1>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                {declined.name} declined the video consultation. The call has been ended.
              </p>
              {declined.reason && (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Reason from patient</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-white">{declined.reason}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-emerald-400" />
              <h1 className="text-2xl font-semibold">Consultation ended</h1>
              <p className="mt-3 text-sm leading-6 text-neutral-300">
                The call has ended for both participants. Camera and microphone are now off.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={call?.role === 'patient' && returnUrl ? returnToPatientApp : () => window.close()}
            className="mt-6 h-11 bg-white px-5 text-sm font-semibold text-neutral-950"
          >
            {call?.role === 'patient' && returnUrl ? 'Return to patient app' : 'Close consultation'}
          </button>
        </div>
      </main>
    );
  }

  const patient = clinical?.appointment?.patient_id;
  const appointment = clinical?.appointment;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-neutral-950 text-white">
      <section className={`absolute inset-0 transition-[right] duration-200 ${isDoctor && panelOpen ? 'lg:right-[390px]' : ''}`}>
        {agoraCredentials && (
          <AgoraCall
            {...agoraCredentials}
            embedded
            userName={displayName}
            onEnd={endCall}
          />
        )}

        {!connected && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950 px-6">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
              <ShieldCheck className="mx-auto mb-5 h-12 w-12 text-emerald-400" />
              <h1 className="text-2xl font-semibold">Private video consultation</h1>
              <p className="mt-3 text-sm leading-6 text-neutral-300">{error || status}</p>
              {!mediaReady && (
                <button type="button" onClick={enableMedia} disabled={starting} className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-neutral-950 disabled:cursor-wait disabled:opacity-70">
                  {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  {starting ? 'Opening consultation...' : error ? 'Try again' : 'Join consultation'}
                </button>
              )}
              {showPermissionHelp && <p className="mt-4 text-xs leading-5 text-amber-300">In Safari, tap aA in the address bar, open Website Settings, and allow Camera and Microphone.</p>}
            </div>
          </div>
        )}
      </section>

      {isDoctor && (
        <>
          {!panelOpen && (
            <button type="button" onClick={() => setPanelOpen(true)} title="Open clinical workspace" className="absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center bg-white text-neutral-950 shadow-xl">
              <PanelRightOpen className="h-5 w-5" />
            </button>
          )}
          <aside className={`absolute inset-y-0 right-0 z-30 w-full max-w-[390px] bg-white text-neutral-950 shadow-2xl transition-transform duration-200 ${panelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-5">
              <div>
                <p className="text-xs font-semibold uppercase text-red-700">Clinical workspace</p>
                <h2 className="text-base font-semibold">{patient?.name || 'Patient consultation'}</h2>
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} title="Close clinical workspace" className="grid h-10 w-10 place-items-center text-neutral-600 hover:bg-neutral-100">
                <PanelRightClose className="h-5 w-5" />
              </button>
            </header>

            <nav className="grid grid-cols-3 border-b border-neutral-200" aria-label="Clinical workspace sections">
              {([
                ['patient', UserRound, 'Patient'],
                ['files', Files, 'Files'],
                ['prescription', ClipboardPenLine, 'Prescription'],
              ] as const).map(([key, Icon, label]) => (
                <button key={key} type="button" onClick={() => setPanelTab(key)} className={`flex h-14 items-center justify-center gap-2 border-b-2 text-xs font-semibold ${panelTab === key ? 'border-red-700 text-red-700' : 'border-transparent text-neutral-500'}`}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </nav>

            <div className="h-[calc(100dvh-7.5rem)] overflow-y-auto px-5 py-5">
              {clinicalError && <p className="mb-4 border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">{clinicalError}</p>}

              {panelTab === 'patient' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="text-xs font-semibold uppercase text-neutral-500">Appointment</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div><dt className="text-neutral-500">Token</dt><dd className="font-semibold">{appointment?.token || '-'}</dd></div>
                      <div><dt className="text-neutral-500">Visit</dt><dd className="font-semibold capitalize">{appointment?.visit_type?.replace('_', ' ') || '-'}</dd></div>
                      <div><dt className="text-neutral-500">Date</dt><dd className="font-semibold">{appointment?.date || '-'}</dd></div>
                      <div><dt className="text-neutral-500">Time</dt><dd className="font-semibold">{appointment?.time || '-'}</dd></div>
                    </dl>
                  </section>
                  <section className="border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold uppercase text-neutral-500">Patient</h3>
                    <p className="mt-3 text-lg font-semibold">{patient?.name || '-'}</p>
                    <p className="mt-1 text-sm text-neutral-600">{[patient?.gender, patient?.date_of_birth, patient?.blood_group].filter(Boolean).join('  |  ') || 'Demographics not provided'}</p>
                    <p className="mt-2 text-sm text-neutral-600">{patient?.phone || patient?.email || ''}</p>
                  </section>
                  <section className="border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold uppercase text-neutral-500">Chief complaint</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{appointment?.chief_complaint || 'None provided'}</p>
                  </section>
                  <section className="border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold uppercase text-neutral-500">Booking history</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{appointment?.history_summary || 'None provided'}</p>
                  </section>
                  <section className="border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold uppercase text-neutral-500">Allergies</h3>
                    <p className="mt-2 text-sm leading-6">{patient?.allergies?.length ? patient.allergies.join(', ') : 'None recorded'}</p>
                  </section>
                  <section className="border-t border-neutral-200 pt-5">
                    <h3 className="text-xs font-semibold uppercase text-neutral-500">Medical history</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{formatMedicalHistory(patient?.medical_history)}</p>
                  </section>
                </div>
              )}

              {panelTab === 'files' && (
                <div>
                  <h3 className="text-sm font-semibold">Reports and past prescriptions</h3>
                  <p className="mt-1 text-xs text-neutral-500">Files attached by the patient when booking this appointment.</p>
                  <div className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
                    {clinical?.documents?.length ? clinical.documents.map((document) => (
                      <div key={document.id} className="flex items-center gap-3 py-4">
                        <FileText className="h-5 w-5 shrink-0 text-red-700" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{document.original_name || document.title}</p>
                          <p className="mt-1 text-xs uppercase text-neutral-500">{document.kind} {fileSize(document.size)}</p>
                        </div>
                        <button type="button" onClick={() => { void openDocument(document.id); }} title="Open document" className="grid h-9 w-9 shrink-0 place-items-center text-neutral-600 hover:bg-neutral-100">
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    )) : <p className="py-8 text-center text-sm text-neutral-500">No files were attached to this booking.</p>}
                  </div>
                </div>
              )}

              {panelTab === 'prescription' && (
                <div className="space-y-5 pb-8">
                  <label className="block text-sm font-semibold">Diagnosis
                    <textarea value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} rows={3} className="mt-2 w-full resize-y border border-neutral-300 px-3 py-2 text-sm font-normal outline-none focus:border-red-700" placeholder="Clinical diagnosis" />
                  </label>
                  <section>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Medications</h3>
                      <button type="button" onClick={() => setMedications((current) => [...current, { name: '', dosage: '', frequency: '', duration: '' }])} className="inline-flex h-9 items-center gap-1 px-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </div>
                    <div className="mt-2 space-y-4">
                      {medications.map((medication, index) => (
                        <div key={`medication-${index}`} className="border-l-2 border-red-700 pl-3">
                          <div className="flex gap-2">
                            <input value={medication.name} onChange={(event) => updateMedication(index, 'name', event.target.value)} className="h-10 min-w-0 flex-1 border border-neutral-300 px-3 text-sm outline-none focus:border-red-700" placeholder="Medicine name" />
                            {medications.length > 1 && <button type="button" onClick={() => setMedications((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="Remove medication" className="grid h-10 w-10 place-items-center text-neutral-500 hover:bg-neutral-100"><Trash2 className="h-4 w-4" /></button>}
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <input value={medication.dosage} onChange={(event) => updateMedication(index, 'dosage', event.target.value)} className="h-9 min-w-0 border border-neutral-300 px-2 text-xs outline-none focus:border-red-700" placeholder="Dose" />
                            <input value={medication.frequency} onChange={(event) => updateMedication(index, 'frequency', event.target.value)} className="h-9 min-w-0 border border-neutral-300 px-2 text-xs outline-none focus:border-red-700" placeholder="Frequency" />
                            <input value={medication.duration} onChange={(event) => updateMedication(index, 'duration', event.target.value)} className="h-9 min-w-0 border border-neutral-300 px-2 text-xs outline-none focus:border-red-700" placeholder="Duration" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <label className="block text-sm font-semibold">Instructions
                    <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className="mt-2 w-full resize-y border border-neutral-300 px-3 py-2 text-sm font-normal outline-none focus:border-red-700" placeholder="How and when the patient should take the medicines" />
                  </label>
                  <label className="block text-sm font-semibold">Consultation notes
                    <textarea value={doctorNotes} onChange={(event) => setDoctorNotes(event.target.value)} rows={3} className="mt-2 w-full resize-y border border-neutral-300 px-3 py-2 text-sm font-normal outline-none focus:border-red-700" placeholder="Consultation summary shared with the patient" />
                  </label>
                  <label className="block text-sm font-semibold">Follow-up date
                    <input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="mt-2 h-11 w-full border border-neutral-300 px-3 text-sm font-normal outline-none focus:border-red-700" />
                  </label>
                  <button type="button" onClick={() => { void savePrescription(); }} disabled={savingPrescription} className="inline-flex h-12 w-full items-center justify-center gap-2 bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
                    {savingPrescription ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Save to patient record
                  </button>
                  {prescriptionMessage && <p className="text-center text-xs font-medium text-neutral-600">{prescriptionMessage}</p>}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
