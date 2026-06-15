import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Appointment, Slot } from '../models/index.js';

dotenv.config();

// Statuses that still OCCUPY a slot. cancelled / no_show / rescheduled (and a
// deleted appointment, which no longer appears here at all) free the slot.
const activeStatuses = ['confirmed', 'scheduled', 'waiting', 'called', 'in_consultation', 'completed'];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not configured');

    await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB_NAME || 'doctorappointment',
    });

    const counts = await Appointment.aggregate([
        { $match: { slot_id: { $ne: null }, status: { $in: activeStatuses } } },
        { $group: { _id: '$slot_id', count: { $sum: 1 } } },
    ]);

    const countBySlot = new Map(counts.map((item) => [String(item._id), item.count]));
    const slots = await Slot.find({}).select('_id max_patients current_patients is_available');
    let updated = 0;

    for (const slot of slots) {
        const currentPatients = countBySlot.get(String(slot._id)) || 0;
        const maxPatients = slot.max_patients || 1;
        const isAvailable = currentPatients < maxPatients;

        if (slot.current_patients !== currentPatients || slot.is_available !== isAvailable) {
            slot.current_patients = currentPatients;
            slot.is_available = isAvailable;
            await slot.save();
            updated += 1;
        }
    }

    console.log(`Checked ${slots.length} slots. Updated ${updated}.`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error('Slot repair failed:', error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
