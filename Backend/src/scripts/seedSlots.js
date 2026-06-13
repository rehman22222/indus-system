import dotenv from 'dotenv';

import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { Doctor, Slot } from '../models/index.js';

dotenv.config();

// Generate realistic appointment slots for every active doctor for the next N
// days. Idempotent: existing slots are kept (so booked slots aren't reset) and
// only missing ones are created.

const DAYS_AHEAD = 14;
const SLOT_MINUTES = 30;
// Clinic hours with a lunch break.
const WORK_BLOCKS = [
    { start: '09:00', end: '13:00' },
    { start: '14:00', end: '17:00' },
];

function toMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

function toHHMM(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function dateIso(d) {
    return d.toISOString().split('T')[0];
}

function buildTimes() {
    const times = [];
    for (const block of WORK_BLOCKS) {
        for (let t = toMinutes(block.start); t + SLOT_MINUTES <= toMinutes(block.end); t += SLOT_MINUTES) {
            times.push({ start: toHHMM(t), end: toHHMM(t + SLOT_MINUTES) });
        }
    }
    return times;
}

async function main() {
    await connectMongoDB();

    const doctors = await Doctor.find({ is_active: true }).select('_id name').lean();
    if (doctors.length === 0) {
        console.log('No active doctors found — run db:seed first.');
        await disconnectMongoDB();
        return;
    }

    const times = buildTimes();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ops = [];
    let days = 0;
    for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
        const day = new Date(today);
        day.setDate(today.getDate() + offset);
        if (day.getDay() === 0) continue; // clinics closed Sundays
        days += 1;
        const date = dateIso(day);

        for (const doc of doctors) {
            for (const t of times) {
                ops.push({
                    updateOne: {
                        filter: { doctor_id: doc._id, date, start_time: t.start },
                        // $setOnInsert keeps any already-booked slot untouched.
                        update: {
                            $setOnInsert: {
                                doctor_id: doc._id,
                                date,
                                start_time: t.start,
                                end_time: t.end,
                                is_available: true,
                                max_patients: 1,
                                current_patients: 0,
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }
    }

    const result = await Slot.bulkWrite(ops, { ordered: false });

    console.log('Slot seeding complete');
    console.log(`Active doctors: ${doctors.length}`);
    console.log(`Working days seeded: ${days} (next ${DAYS_AHEAD} days, Sundays skipped)`);
    console.log(`Slots per doctor per day: ${times.length}`);
    console.log(`New slots created: ${result.upsertedCount}`);
    console.log(`Already existed (kept): ${ops.length - result.upsertedCount}`);

    await disconnectMongoDB();
}

main().catch(async (error) => {
    console.error('Slot seeding failed:', error);
    await disconnectMongoDB();
    process.exit(1);
});
