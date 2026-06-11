# MongoDB Atlas Setup

## Current Database

The backend now uses MongoDB Atlas through Mongoose.

- Cluster: `DoctorAppointment`
- Database: `doctorappointment`
- Backend env key: `MONGODB_URI`
- Database name env key: `MONGODB_DB_NAME`

Do not expose MongoDB credentials in any frontend environment file.

## Backend Startup

The Express API connects to MongoDB before listening for traffic. `/health`
reports database status.

```bash
cd Backend
npm install
npm run db:ensure-indexes
npm run db:seed
npm run dev
```

## Demo Data

Run this anytime to create/update demo records:

```bash
cd Backend
npm run db:seed
```

Seeded data includes:

- 5 departments
- 9 users
- 3 doctors
- 36 appointment slots
- 4 appointments
- queue, notification, prescription, medical-record, setting, audit, and rule records

Useful demo backend OTP emails:

- `admin@indus.org.pk`
- `management1@indus.org.pk`
- `doctor1@indus.org.pk`
- `patient1@example.com`

## Indexes

Indexes are defined in `Backend/src/models/index.js` and created with:

```bash
npm run db:ensure-indexes
```

Important indexes include:

- unique `users.email`
- unique `users.phone`
- `doctors.department_id + specialty + is_available`
- unique `slots.doctor_id + date + start_time`
- unique `appointments.token`
- `appointments.doctor_id + date + time`
- `appointments.patient_id + date`
- unique `queue.appointment_id`
- TTL `otp_verifications.expires_at`

## Analytics

The Python analytics service reads MongoDB through
`Backend/Analytics/data/mongodb_client.py`. It expects the same `MONGODB_URI`
and `MONGODB_DB_NAME` values.

## Remaining Frontend Boundary

The backend and analytics services are Mongo-backed. The React frontend still
contains legacy MONGODB query hooks and should be migrated to Express API calls
before removing MONGODB frontend env keys.
