import dotenv from 'dotenv';

import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import {
    Appointment,
    Department,
    Doctor,
    QueueEntry,
    User,
} from '../models/index.js';
import { hashPassword } from '../services/password.service.js';

dotenv.config();

const today = new Date();
today.setHours(12, 0, 0, 0);

const analyticsPatients = [
    ['analytics.patient01@example.com', 'Zain Ali', 'male', '1991-02-17', 'A+', 'Karachi', ['Hypertension']],
    ['analytics.patient02@example.com', 'Sana Ahmed', 'female', '1985-07-08', 'O+', 'Karachi', ['Diabetes']],
    ['analytics.patient03@example.com', 'Usman Tariq', 'male', '1978-11-24', 'B+', 'Hyderabad', ['Asthma']],
    ['analytics.patient04@example.com', 'Nida Iqbal', 'female', '1998-04-15', 'AB+', 'Karachi', []],
    ['analytics.patient05@example.com', 'Farhan Saeed', 'male', '1969-09-02', 'O-', 'Thatta', ['Cardiac history']],
    ['analytics.patient06@example.com', 'Areeba Shah', 'female', '2016-01-11', 'A-', 'Karachi', ['Dust allergy']],
    ['analytics.patient07@example.com', 'Hamza Khan', 'male', '2002-05-29', 'B-', 'Sukkur', []],
    ['analytics.patient08@example.com', 'Maham Noor', 'female', '1990-12-03', 'AB-', 'Karachi', ['Migraine']],
    ['analytics.patient09@example.com', 'Rizwan Qureshi', 'male', '1982-06-22', 'O+', 'Karachi', ['Arthritis']],
    ['analytics.patient10@example.com', 'Hira Javed', 'female', '1974-03-19', 'A+', 'Hyderabad', ['Diabetes', 'Hypertension']],
    ['analytics.patient11@example.com', 'Danish Raza', 'male', '1958-08-31', 'B+', 'Karachi', ['Stroke history']],
    ['analytics.patient12@example.com', 'Iqra Fatima', 'female', '2019-10-07', 'O+', 'Karachi', []],
    ['analytics.patient13@example.com', 'Saad Mahmood', 'male', '1989-01-25', 'A+', 'Larkana', ['Back pain']],
    ['analytics.patient14@example.com', 'Mehwish Aslam', 'female', '1996-07-17', 'B+', 'Karachi', ['Thyroid disorder']],
    ['analytics.patient15@example.com', 'Kamran Yousuf', 'male', '1965-04-04', 'AB+', 'Karachi', ['COPD']],
    ['analytics.patient16@example.com', 'Rabia Khalid', 'female', '1987-12-14', 'O-', 'Hyderabad', []],
    ['analytics.patient17@example.com', 'Ammar Siddiq', 'male', '2012-09-09', 'A-', 'Karachi', ['Food allergy']],
    ['analytics.patient18@example.com', 'Laiba Hussain', 'female', '2001-02-28', 'B-', 'Karachi', ['Anemia']],
    ['analytics.patient19@example.com', 'Tariq Mirza', 'male', '1971-05-13', 'O+', 'Thatta', ['Epilepsy']],
    ['analytics.patient20@example.com', 'Sehrish Baloch', 'female', '1993-11-21', 'A+', 'Karachi', []],
    ['analytics.patient21@example.com', 'Waqas Nadeem', 'male', '1980-08-06', 'B+', 'Sukkur', ['Kidney stones']],
    ['analytics.patient22@example.com', 'Muneeba Farooq', 'female', '1962-06-01', 'AB-', 'Karachi', ['Hypertension']],
    ['analytics.patient23@example.com', 'Ibrahim Saleem', 'male', '2017-03-27', 'O+', 'Karachi', []],
    ['analytics.patient24@example.com', 'Anum Sheikh', 'female', '1999-10-30', 'A-', 'Hyderabad', ['Anxiety']],
];

const extraDoctors = [
    {
        email: 'doctor4@indus.org.pk',
        name: 'Dr. Sameer Abbas',
        specialty: 'Orthopedics',
        qualification: 'MBBS, FCPS Orthopedic Surgery',
        license_number: 'PMC-ORTH-4004',
        consultation_fee: 2200,
        rating: 4.7,
        total_reviews: 118,
        bio: 'Orthopedic surgeon focused on trauma, joints, and mobility recovery.',
        languages: ['english', 'urdu', 'sindhi'],
    },
    {
        email: 'doctor5@indus.org.pk',
        name: 'Dr. Mahnoor Farid',
        specialty: 'Neurology',
        qualification: 'MBBS, FCPS Neurology',
        license_number: 'PMC-NEUR-5005',
        consultation_fee: 2800,
        rating: 4.8,
        total_reviews: 96,
        bio: 'Neurologist focused on stroke, seizures, headaches, and nerve disorders.',
        languages: ['english', 'urdu'],
    },
];

const complaintMap = {
    Cardiology: [
        'Blood pressure follow-up and chest tightness',
        'Palpitations with shortness of breath',
        'Post-angioplasty routine review',
        'Diabetes with cardiac risk review',
    ],
    'General Medicine': [
        'Fever, cough, and fatigue',
        'Diabetes medication follow-up',
        'Seasonal allergy and breathing discomfort',
        'General weakness and body aches',
    ],
    Pediatrics: [
        'Child wellness and vaccination visit',
        'Fever and sore throat',
        'Growth monitoring follow-up',
        'Asthma review for child patient',
    ],
    Orthopedics: [
        'Knee pain and mobility limitation',
        'Back pain follow-up',
        'Sports injury review',
        'Post-fracture recovery consultation',
    ],
    Neurology: [
        'Migraine and headache follow-up',
        'Seizure medication review',
        'Numbness and nerve pain assessment',
        'Stroke recovery follow-up',
    ],
};

const timeSlots = [
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
];

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(days) {
    const date = new Date(today);
    date.setDate(today.getDate() + days);
    return date;
}

function dateKey(days) {
    return formatDate(addDays(days));
}

function seededRandom(seed) {
    const value = Math.sin(seed * 99991) * 10000;
    return value - Math.floor(value);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function choose(items, seed) {
    return items[Math.floor(seededRandom(seed) * items.length) % items.length];
}

function buildCreatedAt(appointmentDate, leadDays) {
    const created = new Date(appointmentDate);
    created.setDate(created.getDate() - leadDays);
    created.setHours(8 + (leadDays % 8), leadDays % 2 ? 30 : 0, 0, 0);
    return created;
}

async function upsert(model, filter, data) {
    return model.findOneAndUpdate(
        filter,
        { $set: data },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
}

async function seedAnalyticsPatients() {
    const passwordHash = await hashPassword('123456');
    const patients = [];

    for (const [email, name, gender, dateOfBirth, bloodGroup, city, conditions] of analyticsPatients) {
        patients.push(
            await upsert(
                User,
                { email },
                {
                    email,
                    name,
                    role: 'patient',
                    gender,
                    date_of_birth: dateOfBirth,
                    blood_group: bloodGroup,
                    city,
                    phone: `+92300${String(3300000 + patients.length).slice(-7)}`,
                    medical_history: { conditions, surgeries: [] },
                    password_hash: passwordHash,
                    auth_provider: 'password',
                    is_active: true,
                },
            ),
        );
    }

    return patients;
}

async function seedExtraDoctors() {
    const passwordHash = await hashPassword('123456');
    const departments = await Department.find({ is_active: true });
    const byName = Object.fromEntries(departments.map((department) => [department.name, department]));

    for (const doctor of extraDoctors) {
        const department = byName[doctor.specialty];
        if (!department) continue;

        const user = await upsert(
            User,
            { email: doctor.email },
            {
                email: doctor.email,
                name: doctor.name,
                role: 'doctor',
                phone: `+92300111${doctor.license_number.slice(-4)}`,
                password_hash: passwordHash,
                auth_provider: 'password',
                is_active: true,
            },
        );

        await upsert(
            Doctor,
            { license_number: doctor.license_number },
            {
                user_id: user._id,
                department_id: department._id,
                name: doctor.name,
                specialty: doctor.specialty,
                qualification: doctor.qualification,
                experience_years: doctor.specialty === 'Neurology' ? 10 : 11,
                license_number: doctor.license_number,
                consultation_fee: doctor.consultation_fee,
                available_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
                available_hours: { start: '09:00', end: '17:00' },
                max_patients_per_day: 28,
                average_consultation_time: 25,
                rating: doctor.rating,
                total_reviews: doctor.total_reviews,
                bio: doctor.bio,
                languages: doctor.languages,
                is_available: true,
                is_active: true,
            },
        );
    }
}

function getDailyVolume(offset, day) {
    const weekday = day.getDay();
    const isWeekend = weekday === 0;
    const trend = Math.floor((offset + 240) / 45);
    const seasonal = weekday === 1 || weekday === 2 ? 2 : 0;
    const variance = Math.floor(seededRandom(offset + 41) * 4);

    if (offset > 0) return isWeekend ? 2 : 5 + variance;
    if (offset === 0) return 12;
    return isWeekend ? 2 + variance : 6 + trend + seasonal + variance;
}

function getStatus(offset, score, seed) {
    const riskRoll = seededRandom(seed + 101);

    if (offset > 0) {
        return score >= 0.58 || riskRoll > 0.62 ? 'scheduled' : 'confirmed';
    }

    if (offset === 0) {
        if (riskRoll < 0.18) return 'completed';
        if (riskRoll < 0.34) return 'in-progress';
        if (riskRoll < 0.52) return 'called';
        if (riskRoll < 0.76) return 'waiting';
        return 'confirmed';
    }

    const noShowChance = 0.04 + score * 0.28;
    if (riskRoll < noShowChance) return 'no-show';
    if (riskRoll < noShowChance + 0.06) return 'cancelled';
    return 'completed';
}

function getRiskScore({ offset, day, time, appointmentType, patientIndex, doctorIndex, seed }) {
    const hour = Number(time.split(':')[0]);
    const leadPressure = offset > 0 ? Math.min(offset / 45, 0.35) : seededRandom(seed + 4) * 0.2;
    const weekendPressure = day.getDay() === 0 || day.getDay() === 6 ? 0.1 : 0;
    const travelPressure = patientIndex % 5 === 0 || patientIndex % 7 === 0 ? 0.13 : 0;
    const specialtyPressure = doctorIndex % 3 === 0 ? 0.08 : 0;
    const videoPressure = appointmentType === 'video' ? 0.05 : 0;
    const latePressure = hour >= 15 ? 0.05 : 0;
    const randomPressure = seededRandom(seed + 9) * 0.22;

    return Number(
        clamp(
            0.08 +
            leadPressure +
            weekendPressure +
            travelPressure +
            specialtyPressure +
            videoPressure +
            latePressure +
            randomPressure,
            0.03,
            0.92,
        ).toFixed(2),
    );
}

async function seedAnalyticsAppointments(patients) {
    const doctors = await Doctor.find({ is_active: true }).sort({ specialty: 1 });
    if (!doctors.length || !patients.length) {
        throw new Error('Doctors and patients are required before seeding analytics appointments.');
    }

    const operations = [];
    const now = new Date();

    for (let offset = -240; offset <= 45; offset += 1) {
        const day = addDays(offset);
        const date = formatDate(day);
        const dailyVolume = getDailyVolume(offset, day);

        for (let index = 0; index < dailyVolume; index += 1) {
            const seed = (offset + 300) * 100 + index;
            const doctor = doctors[(index + Math.floor(seededRandom(seed) * doctors.length)) % doctors.length];
            const patientIndex = (index * 7 + offset + 900) % patients.length;
            const patient = patients[patientIndex];
            const time = timeSlots[(index + day.getDay() * 2) % timeSlots.length];
            const appointmentType = seededRandom(seed + 2) > 0.72 ? 'video' : 'physical';
            const leadDays = Math.max(1, Math.floor(seededRandom(seed + 3) * 28) + 1);
            const riskScore = getRiskScore({
                offset,
                day,
                time,
                appointmentType,
                patientIndex,
                doctorIndex: doctors.findIndex((item) => item._id.equals(doctor._id)),
                seed,
            });
            const status = getStatus(offset, riskScore, seed);
            const token = `ANL-${date.replaceAll('-', '')}-${String(index + 1).padStart(3, '0')}`;
            const createdAt = buildCreatedAt(day, leadDays);
            const specialtyComplaints = complaintMap[doctor.specialty] || complaintMap['General Medicine'];

            operations.push({
                updateOne: {
                    filter: { token },
                    update: {
                        $set: {
                            patient_id: patient._id,
                            doctor_id: doctor._id,
                            department_id: doctor.department_id,
                            date,
                            time,
                            appointment_type: appointmentType,
                            token,
                            status,
                            chief_complaint: choose(specialtyComplaints, seed + 11),
                            diagnosis: status === 'completed' ? choose(['Stable', 'Follow-up required', 'Medication adjusted', 'Routine recovery'], seed + 12) : undefined,
                            no_show_risk_score: riskScore,
                            governance_status: 'approved',
                            video_room_name: appointmentType === 'video' ? `analytics-${date}-${index + 1}` : undefined,
                            video_room_url: appointmentType === 'video' ? `https://example.daily.co/analytics-${date}-${index + 1}` : undefined,
                            checked_in_at: ['waiting', 'called', 'in-progress', 'completed'].includes(status) ? now : undefined,
                            consultation_start_time: ['in-progress', 'completed'].includes(status) ? now : undefined,
                            consultation_end_time: status === 'completed' ? now : undefined,
                            completed_at: status === 'completed' ? now : undefined,
                            updated_at: now,
                        },
                        $setOnInsert: {
                            created_at: createdAt,
                        },
                    },
                    upsert: true,
                },
            });
        }
    }

    const result = await Appointment.collection.bulkWrite(operations, { ordered: false });
    return {
        planned: operations.length,
        inserted: result.upsertedCount || 0,
        modified: result.modifiedCount || 0,
    };
}

async function rebuildTodayQueue() {
    const todayDate = dateKey(0);
    const waiting = await Appointment.find({
        date: todayDate,
        status: { $in: ['waiting', 'called', 'in-progress'] },
    }).sort({ time: 1 });

    let position = 1;
    for (const appointment of waiting) {
        await upsert(
            QueueEntry,
            { appointment_id: appointment._id },
            {
                appointment_id: appointment._id,
                position,
                status: appointment.status,
                called_at: ['called', 'in-progress'].includes(appointment.status) ? new Date() : undefined,
            },
        );
        position += 1;
    }

    return waiting.length;
}

async function main() {
    await connectMongoDB();

    await seedExtraDoctors();
    const existingPatients = await User.find({ role: 'patient', is_active: true });
    const newPatients = await seedAnalyticsPatients();
    const patientPool = [...existingPatients, ...newPatients];
    const appointmentResult = await seedAnalyticsAppointments(patientPool);
    const queueCount = await rebuildTodayQueue();

    const totalAppointments = await Appointment.countDocuments();
    const totalNoShows = await Appointment.countDocuments({ status: 'no-show' });
    const totalFuture = await Appointment.countDocuments({ date: { $gt: dateKey(0) } });
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalDoctors = await Doctor.countDocuments({ is_active: true });
    const monthlyBuckets = await Appointment.aggregate([
        { $group: { _id: { $substr: ['$date', 0, 7] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    console.log('Analytics demo data seeded successfully');
    console.log(`Appointments planned: ${appointmentResult.planned}`);
    console.log(`Appointments inserted: ${appointmentResult.inserted}`);
    console.log(`Appointments updated: ${appointmentResult.modified}`);
    console.log(`Total appointments: ${totalAppointments}`);
    console.log(`Total no-shows: ${totalNoShows}`);
    console.log(`Future appointments: ${totalFuture}`);
    console.log(`Patients: ${totalPatients}`);
    console.log(`Active doctors: ${totalDoctors}`);
    console.log(`Queue entries for today: ${queueCount}`);
    console.log(`Monthly buckets: ${monthlyBuckets.map((bucket) => `${bucket._id}:${bucket.count}`).join(', ')}`);

    await disconnectMongoDB();
}

main().catch(async (error) => {
    console.error('Failed to seed analytics data:', error);
    await disconnectMongoDB();
    process.exit(1);
});
