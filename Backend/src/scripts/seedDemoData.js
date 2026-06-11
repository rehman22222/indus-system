import dotenv from 'dotenv';

import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import {
    Appointment,
    AppointmentRule,
    AuditLog,
    Department,
    Doctor,
    MedicalRecord,
    Notification,
    Prescription,
    QueueEntry,
    Slot,
    SystemSetting,
    User,
} from '../models/index.js';
import { hashPassword } from '../services/password.service.js';

dotenv.config();

const today = new Date();

function addDays(days) {
    const date = new Date(today);
    date.setDate(today.getDate() + days);
    return date.toISOString().split('T')[0];
}

function dayToken(date) {
    return date.replaceAll('-', '').slice(4);
}

async function upsert(model, filter, data) {
    return model.findOneAndUpdate(
        filter,
        { $set: data },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
}

async function seedDepartments() {
    const departments = [
        {
            name: 'Cardiology',
            description: 'Heart and vascular care',
            icon: 'HeartPulse',
            color: '#dc2626',
            capacity: 45,
            floor_number: 2,
            contact_email: 'cardiology@indus.org.pk',
            contact_phone: '+92-21-111-111-201',
        },
        {
            name: 'General Medicine',
            description: 'Primary diagnosis and routine consultations',
            icon: 'Stethoscope',
            color: '#0ea5e9',
            capacity: 60,
            floor_number: 1,
            contact_email: 'medicine@indus.org.pk',
            contact_phone: '+92-21-111-111-101',
        },
        {
            name: 'Pediatrics',
            description: 'Child health and vaccination care',
            icon: 'Baby',
            color: '#16a34a',
            capacity: 35,
            floor_number: 1,
            contact_email: 'pediatrics@indus.org.pk',
            contact_phone: '+92-21-111-111-102',
        },
        {
            name: 'Orthopedics',
            description: 'Bone, joint, and trauma care',
            icon: 'Bone',
            color: '#9333ea',
            capacity: 30,
            floor_number: 3,
            contact_email: 'orthopedics@indus.org.pk',
            contact_phone: '+92-21-111-111-301',
        },
        {
            name: 'Neurology',
            description: 'Brain, spine, and nerve care',
            icon: 'Brain',
            color: '#4f46e5',
            capacity: 25,
            floor_number: 3,
            contact_email: 'neurology@indus.org.pk',
            contact_phone: '+92-21-111-111-302',
        },
    ];

    const result = {};
    for (const department of departments) {
        result[department.name] = await upsert(
            Department,
            { name: department.name },
            { ...department, is_active: true },
        );
    }
    return result;
}

async function seedUsers() {
    const demoPasswordHash = await hashPassword('123456');
    const users = [
        {
            email: 'admin@gmail.com',
            name: 'Admin',
            role: 'admin',
            phone: '+923001110000',
        },
        {
            email: 'admin@indus.org.pk',
            name: 'Ayesha Khan',
            role: 'admin',
            phone: '+923001110001',
        },
        {
            email: 'management1@indus.org.pk',
            name: 'Bilal Ahmed',
            role: 'management',
            phone: '+923001110002',
        },
        {
            email: 'doctor1@indus.org.pk',
            name: 'Dr. Sara Malik',
            role: 'doctor',
            phone: '+923001110101',
        },
        {
            email: 'doctor2@indus.org.pk',
            name: 'Dr. Omar Siddiqui',
            role: 'doctor',
            phone: '+923001110102',
        },
        {
            email: 'doctor3@indus.org.pk',
            name: 'Dr. Hina Raza',
            role: 'doctor',
            phone: '+923001110103',
        },
        {
            email: 'patient1@example.com',
            name: 'Ali Raza',
            role: 'patient',
            phone: '+923001220001',
            gender: 'male',
            date_of_birth: '1994-03-12',
            blood_group: 'B+',
            city: 'Karachi',
            allergies: ['Penicillin'],
            medical_history: { conditions: ['Hypertension'], surgeries: [] },
        },
        {
            email: 'patient2@example.com',
            name: 'Fatima Noor',
            role: 'patient',
            phone: '+923001220002',
            gender: 'female',
            date_of_birth: '1988-09-20',
            blood_group: 'O+',
            city: 'Karachi',
            allergies: [],
            medical_history: { conditions: ['Asthma'], surgeries: [] },
        },
        {
            email: 'patient3@example.com',
            name: 'Hassan Iqbal',
            role: 'patient',
            phone: '+923001220003',
            gender: 'male',
            date_of_birth: '2018-01-08',
            blood_group: 'A+',
            city: 'Hyderabad',
            allergies: ['Dust'],
            medical_history: { conditions: [], surgeries: [] },
        },
        {
            email: 'patient4@example.com',
            name: 'Maryam Sheikh',
            role: 'patient',
            phone: '+923001220004',
            gender: 'female',
            date_of_birth: '1975-11-30',
            blood_group: 'AB+',
            city: 'Karachi',
            allergies: [],
            medical_history: { conditions: ['Diabetes'], surgeries: ['Appendectomy'] },
        },
    ];

    const result = {};
    for (const user of users) {
        result[user.email] = await upsert(
            User,
            { email: user.email },
            {
                ...user,
                password_hash: demoPasswordHash,
                auth_provider: 'password',
                is_active: true,
            },
        );
    }
    return result;
}

async function seedDoctors(users, departments) {
    const doctors = [
        {
            user: users['doctor1@indus.org.pk'],
            department: departments.Cardiology,
            name: 'Dr. Sara Malik',
            specialty: 'Cardiology',
            qualification: 'MBBS, FCPS Cardiology',
            experience_years: 12,
            license_number: 'PMC-CARD-1001',
            consultation_fee: 2500,
            rating: 4.8,
            total_reviews: 186,
            bio: 'Specialist in preventive cardiology and hypertension management.',
            languages: ['english', 'urdu'],
        },
        {
            user: users['doctor2@indus.org.pk'],
            department: departments['General Medicine'],
            name: 'Dr. Omar Siddiqui',
            specialty: 'General Medicine',
            qualification: 'MBBS, FCPS Medicine',
            experience_years: 9,
            license_number: 'PMC-MED-2002',
            consultation_fee: 1800,
            rating: 4.6,
            total_reviews: 142,
            bio: 'General physician focused on chronic care and diagnostics.',
            languages: ['english', 'urdu', 'sindhi'],
        },
        {
            user: users['doctor3@indus.org.pk'],
            department: departments.Pediatrics,
            name: 'Dr. Hina Raza',
            specialty: 'Pediatrics',
            qualification: 'MBBS, FCPS Pediatrics',
            experience_years: 8,
            license_number: 'PMC-PED-3003',
            consultation_fee: 1600,
            rating: 4.9,
            total_reviews: 210,
            bio: 'Pediatrician with a focus on child wellness and vaccination.',
            languages: ['english', 'urdu'],
        },
    ];

    const result = {};
    for (const doctor of doctors) {
        const saved = await upsert(
            Doctor,
            { license_number: doctor.license_number },
            {
                user_id: doctor.user._id,
                department_id: doctor.department._id,
                name: doctor.name,
                specialty: doctor.specialty,
                qualification: doctor.qualification,
                experience_years: doctor.experience_years,
                license_number: doctor.license_number,
                consultation_fee: doctor.consultation_fee,
                available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                available_hours: { start: '09:00', end: '17:00' },
                max_patients_per_day: 24,
                average_consultation_time: 30,
                rating: doctor.rating,
                total_reviews: doctor.total_reviews,
                bio: doctor.bio,
                languages: doctor.languages,
                is_available: true,
                is_active: true,
            },
        );
        result[doctor.specialty] = saved;
    }
    return result;
}

async function seedSlots(doctors) {
    const slotPlan = [
        { doctor: doctors.Cardiology, dates: [0, 1, 2], times: ['09:00', '09:30', '10:00', '10:30'] },
        { doctor: doctors['General Medicine'], dates: [0, 1, 2], times: ['11:00', '11:30', '12:00', '12:30'] },
        { doctor: doctors.Pediatrics, dates: [0, 1, 2], times: ['14:00', '14:30', '15:00', '15:30'] },
    ];

    const slots = [];
    for (const plan of slotPlan) {
        for (const offset of plan.dates) {
            for (const start of plan.times) {
                const [hour, minute] = start.split(':').map(Number);
                const endDate = new Date(2026, 0, 1, hour, minute + 30);
                const end = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                slots.push(
                    await upsert(
                        Slot,
                        {
                            doctor_id: plan.doctor._id,
                            date: addDays(offset),
                            start_time: start,
                        },
                        {
                            doctor_id: plan.doctor._id,
                            date: addDays(offset),
                            start_time: start,
                            end_time: end,
                            max_patients: 1,
                            current_patients: 0,
                            is_available: true,
                        },
                    ),
                );
            }
        }
    }

    return slots;
}

async function reserveSlot(doctorId, date, startTime) {
    const slot = await Slot.findOne({ doctor_id: doctorId, date, start_time: startTime });
    if (!slot) return null;

    slot.current_patients = 1;
    slot.is_available = false;
    await slot.save();
    return slot;
}

async function seedAppointments(users, doctors) {
    const todayDate = addDays(0);
    const tomorrowDate = addDays(1);
    const nextDate = addDays(2);

    const appointmentPlan = [
        {
            token: `CARD-${dayToken(todayDate)}-001`,
            patient: users['patient1@example.com'],
            doctor: doctors.Cardiology,
            date: todayDate,
            time: '09:00',
            status: 'waiting',
            appointment_type: 'physical',
            chief_complaint: 'Chest discomfort and high blood pressure',
            no_show_risk_score: 0.18,
        },
        {
            token: `MED-${dayToken(todayDate)}-002`,
            patient: users['patient2@example.com'],
            doctor: doctors['General Medicine'],
            date: todayDate,
            time: '11:00',
            status: 'confirmed',
            appointment_type: 'video',
            chief_complaint: 'Breathing difficulty and seasonal allergy',
            no_show_risk_score: 0.31,
            video_room_url: 'https://example.daily.co/demo-medicine-room',
            video_room_name: 'demo-medicine-room',
        },
        {
            token: `PED-${dayToken(tomorrowDate)}-003`,
            patient: users['patient3@example.com'],
            doctor: doctors.Pediatrics,
            date: tomorrowDate,
            time: '14:00',
            status: 'scheduled',
            appointment_type: 'physical',
            chief_complaint: 'Routine child wellness check',
            no_show_risk_score: 0.09,
        },
        {
            token: `CARD-${dayToken(nextDate)}-004`,
            patient: users['patient4@example.com'],
            doctor: doctors.Cardiology,
            date: nextDate,
            time: '09:30',
            status: 'confirmed',
            appointment_type: 'physical',
            chief_complaint: 'Diabetes follow-up with cardiac risk review',
            no_show_risk_score: 0.42,
        },
    ];

    const appointments = {};
    for (const item of appointmentPlan) {
        const slot = await reserveSlot(item.doctor._id, item.date, item.time);
        const saved = await upsert(
            Appointment,
            { token: item.token },
            {
                patient_id: item.patient._id,
                doctor_id: item.doctor._id,
                department_id: item.doctor.department_id,
                slot_id: slot?._id,
                date: item.date,
                time: item.time,
                appointment_type: item.appointment_type,
                token: item.token,
                status: item.status,
                chief_complaint: item.chief_complaint,
                no_show_risk_score: item.no_show_risk_score,
                video_room_url: item.video_room_url,
                video_room_name: item.video_room_name,
                governance_status: 'approved',
            },
        );
        appointments[item.token] = saved;
    }
    return appointments;
}

async function seedQueue(appointments) {
    const waitingAppointments = Object.values(appointments).filter((a) => a.status === 'waiting');
    let position = 1;
    for (const appointment of waitingAppointments) {
        await upsert(
            QueueEntry,
            { appointment_id: appointment._id },
            {
                appointment_id: appointment._id,
                position,
                status: 'waiting',
            },
        );
        position += 1;
    }
}

async function seedMedicalRecordsAndPrescriptions(users, doctors, appointments) {
    const cardiologyAppointment = appointments[Object.keys(appointments).find((t) => t.startsWith('CARD-'))];
    const medicineAppointment = appointments[Object.keys(appointments).find((t) => t.startsWith('MED-'))];

    if (cardiologyAppointment) {
        await upsert(
            Prescription,
            { appointment_id: cardiologyAppointment._id },
            {
                appointment_id: cardiologyAppointment._id,
                doctor_id: doctors.Cardiology._id,
                patient_id: users['patient1@example.com']._id,
                medications: [
                    { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: '30 days' },
                    { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily', duration: '14 days' },
                ],
                instructions: 'Monitor blood pressure twice daily and reduce salt intake.',
                valid_until: addDays(30),
            },
        );
    }

    if (medicineAppointment) {
        await upsert(
            MedicalRecord,
            {
                patient_id: users['patient2@example.com']._id,
                appointment_id: medicineAppointment._id,
                title: 'Pulmonary Consultation Note',
            },
            {
                patient_id: users['patient2@example.com']._id,
                appointment_id: medicineAppointment._id,
                record_type: 'consultation',
                title: 'Pulmonary Consultation Note',
                description: 'Patient reports seasonal breathing difficulty. Inhaler technique reviewed.',
                recorded_date: addDays(0),
                recorded_by: users['doctor2@indus.org.pk']._id,
            },
        );
    }
}

async function seedNotifications(users, appointments) {
    const notifications = [
        {
            user: users['patient1@example.com'],
            title: 'Appointment Check-In',
            body: `Your appointment token is ${Object.keys(appointments)[0]}. Please wait for your turn.`,
            data: { type: 'queue_update' },
        },
        {
            user: users['patient2@example.com'],
            title: 'Video Consultation Ready',
            body: 'Your video consultation room is ready.',
            data: { type: 'video_consultation' },
        },
    ];

    for (const item of notifications) {
        await Notification.findOneAndUpdate(
            { user_id: item.user._id, title: item.title },
            {
                $set: {
                    user_id: item.user._id,
                    title: item.title,
                    body: item.body,
                    data: item.data,
                    read: false,
                    sent_at: new Date(),
                },
            },
            { upsert: true, new: true },
        );
    }
}

async function seedSettingsAndRules(users) {
    await upsert(
        SystemSetting,
        { setting_key: 'hospital_profile' },
        {
            setting_key: 'hospital_profile',
            setting_value: {
                name: 'INDUS Hospital Demo',
                timezone: 'Asia/Karachi',
                appointmentBufferMinutes: 10,
            },
            description: 'Demo hospital profile for local/Atlas testing.',
            is_public: true,
            updated_by: users['admin@indus.org.pk']._id,
        },
    );

    await upsert(
        AppointmentRule,
        { rule_name: 'standard_cancellation_window' },
        {
            rule_name: 'standard_cancellation_window',
            rule_type: 'cancellation',
            rule_config: {
                minimumHoursBeforeAppointment: 4,
                allowPatientCancellation: true,
            },
            is_active: true,
            priority: 10,
        },
    );

    await upsert(
        AuditLog,
        {
            action: 'seed_demo_data',
            collection_name: 'system',
        },
        {
            user_id: users['admin@indus.org.pk']._id,
            action: 'seed_demo_data',
            collection_name: 'system',
            new_data: { seeded_at: new Date().toISOString(), source: 'seedDemoData.js' },
            ip_address: '127.0.0.1',
            user_agent: 'seed-script',
        },
    );
}

async function main() {
    await connectMongoDB();

    const departments = await seedDepartments();
    const users = await seedUsers();
    const doctors = await seedDoctors(users, departments);
    await seedSlots(doctors);
    const appointments = await seedAppointments(users, doctors);
    await seedQueue(appointments);
    await seedMedicalRecordsAndPrescriptions(users, doctors, appointments);
    await seedNotifications(users, appointments);
    await seedSettingsAndRules(users);

    console.log('Demo data seeded successfully');
    console.log(`Users: ${await User.countDocuments()}`);
    console.log(`Departments: ${await Department.countDocuments()}`);
    console.log(`Doctors: ${await Doctor.countDocuments()}`);
    console.log(`Slots: ${await Slot.countDocuments()}`);
    console.log(`Appointments: ${await Appointment.countDocuments()}`);
    console.log(`Queue entries: ${await QueueEntry.countDocuments()}`);

    await disconnectMongoDB();
}

main().catch(async (error) => {
    console.error('Failed to seed demo data:', error);
    await disconnectMongoDB();
    process.exit(1);
});
