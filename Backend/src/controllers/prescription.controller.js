import { AuditLog, Doctor, Prescription } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize, serializeMany } from '../utils/mongo.js';
import {
    buildListFilter,
    buildProjection,
    buildSort,
    getListOptions,
    pagedFind,
} from '../utils/api.js';
import { invalidateCache } from '../services/cache.service.js';

const populate = [
    { path: 'appointment_id', select: 'token date time status chief_complaint' },
    { path: 'doctor_id', select: 'name specialty' },
    { path: 'patient_id', select: 'name email phone blood_group allergies medical_history' },
];

const FIELD_MAP = {
    doctorId: 'doctor_id',
    patientId: 'patient_id',
    appointmentId: 'appointment_id',
};

const SORT_FIELDS = ['created_at', 'updated_at', 'doctor_id', 'patient_id', 'appointment_id'];
const PROJECTION_FIELDS = [
    '_id',
    'id',
    'appointment_id',
    'doctor_id',
    'patient_id',
    'diagnosis',
    'medications',
    'instructions',
    'notes',
    'follow_up_date',
    'valid_until',
    'created_at',
    'updated_at',
];

async function currentDoctorId(req) {
    if (req.userRole !== 'doctor') return null;
    const doctor = await Doctor.findOne({ user_id: req.user.id }).select('_id').lean();
    if (!doctor) throw new AppError('Doctor profile not found', 403);
    return doctor._id;
}

async function scopedFilter(req, base = {}) {
    const filter = { ...base };
    if (req.userRole === 'patient') filter.patient_id = requireObjectId(req.user.id, 'patientId');
    if (req.userRole === 'doctor') filter.doctor_id = await currentDoctorId(req);
    return filter;
}

export const listPrescriptions = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = await scopedFilter(req, buildListFilter(req, { fieldMap: FIELD_MAP }));
    const sort = buildSort(req.query, {
        fieldMap: FIELD_MAP,
        allowed: SORT_FIELDS,
        fallback: { created_at: -1 },
    });
    const projection = buildProjection(req.query, PROJECTION_FIELDS);

    const { items, pagination } = await pagedFind(Prescription, filter, {
        ...list,
        sort,
        projection,
        populate,
        maxTimeMS: 5000,
    });
    const prescriptions = serializeMany(items);
    res.status(200).json({ prescriptions, data: prescriptions, pagination });
};

export const getPrescriptionById = async (req, res) => {
    const filter = await scopedFilter(req, { _id: requireObjectId(req.params.id, 'prescriptionId') });
    const prescription = await Prescription.findOne(filter)
        .populate(populate)
        .maxTimeMS(5000)
        .lean({ virtuals: true });

    if (!prescription) throw new AppError('Prescription not found', 404);
    const data = serialize(prescription);
    res.status(200).json({ prescription: data, data });
};

export const createPrescription = async (req, res) => {
    const payload = {
        appointment_id: requireObjectId(req.body.appointment_id || req.body.appointmentId, 'appointmentId'),
        doctor_id: requireObjectId(req.body.doctor_id || req.body.doctorId, 'doctorId'),
        patient_id: requireObjectId(req.body.patient_id || req.body.patientId, 'patientId'),
        diagnosis: req.body.diagnosis,
        medications: req.body.medications,
        instructions: req.body.instructions,
        notes: req.body.notes,
        follow_up_date: req.body.follow_up_date || req.body.followUpDate,
        valid_until: req.body.valid_until,
    };

    if (!Array.isArray(payload.medications) || payload.medications.length === 0) {
        throw new AppError('At least one medication is required', 400);
    }

    if (req.userRole === 'patient') throw new AppError('Patients cannot create prescriptions', 403);
    if (req.userRole === 'doctor') {
        const doctorId = await currentDoctorId(req);
        if (doctorId.toString() !== payload.doctor_id.toString()) {
            throw new AppError('Doctors can only create their own prescriptions', 403);
        }
    }

    const prescription = await Prescription.create(payload);
    await AuditLog.create({
        user_id: req.user?.id,
        action: 'prescription.created',
        collection_name: 'prescriptions',
        record_id: prescription._id,
        new_data: payload,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['prescriptions:*', 'appointments:*', 'dashboard:*']);

    const data = serialize(await Prescription.findById(prescription._id).populate(populate));
    res.status(201).json({ prescription: data, data });
};

export const updatePrescription = async (req, res) => {
    const filter = await scopedFilter(req, { _id: requireObjectId(req.params.id, 'prescriptionId') });
    if (req.userRole === 'patient') throw new AppError('Patients cannot update prescriptions', 403);

    const updates = { ...req.body };
    delete updates.id;
    delete updates._id;
    delete updates.created_at;
    delete updates.updated_at;

    const prescription = await Prescription.findOneAndUpdate(filter, updates, {
        new: true,
        runValidators: true,
    }).populate(populate);

    if (!prescription) throw new AppError('Prescription not found', 404);

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'prescription.updated',
        collection_name: 'prescriptions',
        record_id: prescription._id,
        new_data: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['prescriptions:*', 'appointments:*', 'dashboard:*']);

    const data = serialize(prescription);
    res.status(200).json({ prescription: data, data });
};
