import dotenv from 'dotenv';

import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { Appointment, Department, Doctor, Notification, QueueEntry, User } from '../models/index.js';
import { hashPassword } from '../services/password.service.js';

dotenv.config();

const DEMO_PASSWORD = '123456';
const DOCTOR_EMAIL = 'doctor1@indus.org.pk';

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

function compactDate(date) {
    return date.replaceAll('-', '');
}

async function upsertPatient(patient, passwordHash) {
    return User.findOneAndUpdate(
        { email: patient.email },
        {
            $set: {
                name: patient.name,
                email: patient.email,
                phone: patient.phone,
                role: 'patient',
                gender: patient.gender,
                date_of_birth: patient.date_of_birth,
                blood_group: patient.blood_group,
                allergies: patient.allergies,
                medical_history: patient.medical_history,
                is_active: true,
            },
            $setOnInsert: {
                password_hash: passwordHash,
            },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
}

async function resolveDoctor() {
    const doctorUser = await User.findOne({ email: DOCTOR_EMAIL }).select('_id email name').lean();
    if (!doctorUser) {
        throw new Error(`Doctor user not found: ${DOCTOR_EMAIL}. Run npm run db:seed first.`);
    }

    const doctor = await Doctor.findOne({ user_id: doctorUser._id }).lean();
    if (!doctor) {
        throw new Error(`Doctor profile not found for ${DOCTOR_EMAIL}. Run npm run db:seed first.`);
    }

    const department = doctor.department_id
        ? await Department.findById(doctor.department_id).lean()
        : await Department.findOne({ is_active: true }).lean();

    if (!department) {
        throw new Error('Department not found. Run npm run db:seed first.');
    }

    return { doctor, doctorUser, department };
}

async function upsertVideoAppointment({ patient, doctor, department, date, token, time, status, chiefComplaint, consentRecorded }) {
    const saved = await Appointment.findOneAndUpdate(
        { token },
        {
            $set: {
                patient_id: patient._id,
                doctor_id: doctor._id,
                department_id: department._id,
                date,
                time,
                appointment_type: 'video',
                token,
                status,
                chief_complaint: chiefComplaint,
                no_show_risk_score: 0.22,
                governance_status: 'approved',
                consent_recorded: consentRecorded,
                consent_recorded_at: consentRecorded ? new Date() : null,
            },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    if (['waiting', 'called', 'in_consultation'].includes(status)) {
        await QueueEntry.findOneAndUpdate(
            { appointment_id: saved._id },
            {
                $set: {
                    appointment_id: saved._id,
                    position: status === 'in_consultation' ? 1 : 2,
                    status,
                },
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
    } else {
        await QueueEntry.deleteOne({ appointment_id: saved._id });
    }


    await Notification.findOneAndUpdate(
        { user_id: patient._id, title: 'Video consultation demo ready', 'data.appointment_token': token },
        {
            $set: {
                user_id: patient._id,
                title: 'Video consultation demo ready',
                body: `Your demo video appointment ${token} is ready for testing.`,
                data: {
                    appointment_id: saved._id.toString(),
                    appointment_token: token,
                    appointment_type: 'video',
                    status,
                },
                read: false,
                sent_at: new Date(),
            },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    return saved;
}

async function seedVideoCallDemoData() {
    await connectMongoDB();

    try {
        const date = todayString();
        const tokenDate = compactDate(date);
        const passwordHash = await hashPassword(DEMO_PASSWORD);
        const { doctor, doctorUser, department } = await resolveDoctor();

        const patientPlans = [
            {
                name: 'Fatima Noor',
                email: 'video.patient1@example.com',
                phone: '+923003301101',
                gender: 'female',
                date_of_birth: '1994-04-18',
                blood_group: 'A+',
                allergies: ['Penicillin'],
                medical_history: ['Hypertension follow-up'],
                token: `VID-${tokenDate}-001`,
                time: '10:30',
                status: 'waiting',
                chiefComplaint: 'Follow-up video consultation for blood pressure review',
                consentRecorded: false,
            },
            {
                name: 'Hamza Ahmed',
                email: 'video.patient2@example.com',
                phone: '+923003301102',
                gender: 'male',
                date_of_birth: '1988-09-12',
                blood_group: 'B+',
                allergies: [],
                medical_history: ['Diabetes type 2'],
                token: `VID-${tokenDate}-002`,
                time: '11:15',
                status: 'confirmed',
                chiefComplaint: 'Online diabetes medication review',
                consentRecorded: false,
            },
            {
                name: 'Sana Iqbal',
                email: 'video.patient3@example.com',
                phone: '+923003301103',
                gender: 'female',
                date_of_birth: '1991-01-26',
                blood_group: 'O+',
                allergies: ['Dust'],
                medical_history: ['Migraine'],
                token: `VID-${tokenDate}-003`,
                time: '12:00',
                status: 'in_consultation',
                chiefComplaint: 'Active video consultation demo case',
                consentRecorded: true,
            },
        ];

        const appointments = [];
        for (const plan of patientPlans) {
            const patient = await upsertPatient(plan, passwordHash);
            const appointment = await upsertVideoAppointment({
                patient,
                doctor,
                department,
                date,
                token: plan.token,
                time: plan.time,
                status: plan.status,
                chiefComplaint: plan.chiefComplaint,
                consentRecorded: plan.consentRecorded,
            });
            appointments.push(appointment);
        }

        console.log('Video consultation demo data seeded.');
        console.log(`Doctor: ${doctorUser.name || doctor.name} <${doctorUser.email}>`);
        console.log(`Date: ${date}`);
        for (const appointment of appointments) {
            console.log(`${appointment.token} | ${appointment.time} | ${appointment.status} | video`);
        }
    } finally {
        await disconnectMongoDB();
    }
}

seedVideoCallDemoData().catch((error) => {
    console.error('Failed to seed video consultation demo data:', error.message);
    process.exitCode = 1;
});
