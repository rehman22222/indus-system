import { Appointment, Doctor, MedicalDocument } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize, serializeMany } from '../utils/mongo.js';
import { getListOptions, getPaginationMeta } from '../utils/api.js';
import { emitQueueEvent } from '../services/realtime.service.js';

// ~6.5 MB of binary once base64-decoded; keeps us under the 10mb body limit.
const MAX_BASE64_CHARS = 9_000_000;
const KINDS = ['report', 'prescription', 'other'];
const STAFF = new Set(['admin', 'management', 'receptionist']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

async function currentDoctor(req) {
    if (req.userRole !== 'doctor') return null;
    return Doctor.findOne({ user_id: req.user.id, is_active: true }).select('_id').lean();
}

async function canAccessPatient(req, patientId, appointment = null) {
    if (STAFF.has(req.userRole)) return true;
    if (req.userRole === 'patient') return req.user.id === String(patientId);
    if (req.userRole !== 'doctor') return false;

    const doctor = await currentDoctor(req);
    if (!doctor) return false;
    if (appointment) return String(appointment.doctor_id) === String(doctor._id);

    return Boolean(await Appointment.exists({ patient_id: patientId, doctor_id: doctor._id }));
}

/**
 * POST /api/v1/documents
 * Patient uploads a report / past prescription (base64). Doctors/staff may also
 * attach documents for a patient.
 */
export const uploadDocument = async (req, res) => {
    const patientId = requireObjectId(req.body.patientId || req.body.patient_id || req.user.id, 'patientId');
    const appointmentId = req.body.appointmentId || req.body.appointment_id;
    const appointment = appointmentId
        ? await Appointment.findById(requireObjectId(appointmentId, 'appointmentId'))
            .select('patient_id doctor_id')
            .lean()
        : null;

    if (appointmentId && !appointment) throw new AppError('Appointment not found', 404);
    if (appointment && String(appointment.patient_id) !== String(patientId)) {
        throw new AppError('Appointment does not belong to this patient', 409);
    }
    if (!await canAccessPatient(req, patientId.toString(), appointment)) throw new AppError('Forbidden', 403);

    const dataBase64 = String(req.body.dataBase64 || req.body.data || '');
    if (!dataBase64) throw new AppError('File data is required', 400);
    if (dataBase64.length > MAX_BASE64_CHARS) throw new AppError('File is too large (max ~6 MB)', 413);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64)) throw new AppError('Invalid file encoding', 400);

    const kindInput = String(req.body.kind || 'report').toLowerCase();
    const kind = KINDS.includes(kindInput) ? kindInput : 'report';

    const mime = String(req.body.mime || 'image/jpeg').toLowerCase().slice(0, 80);
    if (!ALLOWED_MIME.has(mime)) throw new AppError('Only JPEG, PNG, WebP, and PDF files are supported', 415);

    const doc = await MedicalDocument.create({
        patient_id: patientId,
        appointment_id: appointment?._id,
        doctor_id: appointment?.doctor_id,
        kind,
        title: String(req.body.title || (kind === 'prescription' ? 'Prescription' : 'Report')).slice(0, 140),
        original_name: String(req.body.originalName || req.body.original_name || '').slice(0, 180),
        mime,
        size: Number(req.body.size) || Math.round(dataBase64.length * 0.75),
        data: dataBase64,
        uploaded_by: req.user?.id,
    });

    const out = serialize(doc);
    delete out.data;

    if (appointment?.doctor_id) {
        emitQueueEvent('documents.updated', {
            document_id: doc._id.toString(),
            appointment_id: appointment._id.toString(),
            patient_id: patientId.toString(),
            doctor_id: appointment.doctor_id.toString(),
        });
    }
    res.status(201).json({ message: 'Document uploaded', document: out, data: out });
};

/**
 * GET /api/v1/documents?patient_id=...&appointment_id=...
 * Lists document metadata (no file payload).
 */
export const listDocuments = async (req, res) => {
    const filter = {};
    const patientIdQuery = req.query.patient_id || req.query.patientId;

    if (patientIdQuery) {
        const pid = requireObjectId(patientIdQuery, 'patientId');
        if (!await canAccessPatient(req, pid.toString())) throw new AppError('Forbidden', 403);
        filter.patient_id = pid;
    } else if (req.userRole === 'patient') {
        filter.patient_id = requireObjectId(req.user.id, 'patientId');
    } else {
        throw new AppError('patient_id is required', 400);
    }

    if (req.query.appointment_id || req.query.appointmentId) {
        filter.appointment_id = requireObjectId(req.query.appointment_id || req.query.appointmentId, 'appointmentId');
    }
    if (req.query.kind && KINDS.includes(String(req.query.kind))) {
        filter.kind = String(req.query.kind);
    }

    const { page, limit, skip } = getListOptions(req.query);
    const [items, total] = await Promise.all([
        MedicalDocument.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).maxTimeMS(5000).lean({ virtuals: true }),
        MedicalDocument.countDocuments(filter).maxTimeMS(5000),
    ]);

    const documents = serializeMany(items);
    res.status(200).json({ documents, data: documents, pagination: getPaginationMeta({ page, limit, total }) });
};

/**
 * GET /api/v1/documents/:id
 * Returns a single document including its base64 payload (for viewing).
 */
export const getDocument = async (req, res) => {
    const id = requireObjectId(req.params.id, 'documentId');
    const doc = await MedicalDocument.findById(id).select('+data').lean({ virtuals: true });
    if (!doc) throw new AppError('Document not found', 404);
    const appointment = doc.appointment_id
        ? await Appointment.findById(doc.appointment_id).select('doctor_id').lean()
        : null;
    if (!await canAccessPatient(req, doc.patient_id.toString(), appointment)) throw new AppError('Forbidden', 403);

    const out = serialize(doc);
    res.status(200).json({ document: out, data: out });
};
