# Database Documentation

## Overview
MongoDB database hosted on MONGODB for INDUS Hospital Management System.

**Provider:** MONGODB  
**Project ID:** vlcbwrfydjjnsjtuismw  
**Database:** MongoDB 15  
**Schema:** public  

---

## Connection Details

**Project URL:** <removed>  
**Database URL:** `MongoDB://postgres:[PASSWORD]@<removed>:5432/postgres`  

**Keys:**
- **Anon Key:** (Public, safe for frontend)
- **Service Role Key:** (Secret, backend only - bypasses RLS)

---

## Database Schema

### Schema Files Location
`FYP/Database/`
- `00_complete_schema.sql` - Complete schema (all files combined)
- `01_patients.sql` - Patient-related tables
- `02_doctors.sql` - Doctor-related tables
- `03_management.sql` - Operations & queue tables
- `04_admin.sql` - System configuration tables
- `05_otp.sql` - OTP verification tables

---

## Tables Overview

### Core Tables

#### 1. `users`
Central user table for all roles.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'patient' 
        CHECK (role IN ('patient', 'doctor', 'admin', 'management')),
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    allergies TEXT[],
    medical_history JSONB,
    fcm_token TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_users_role` ON role
- `idx_users_email` ON email
- `idx_users_phone` ON phone

**RLS Policies:**
- Patients can view/update own profile
- Doctors can view patient profiles
- Admin can view all users

---

#### 2. `doctors`
Doctor profiles and details.

```sql
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id),
    qualification TEXT,
    experience_years INTEGER,
    license_number TEXT UNIQUE,
    consultation_fee DECIMAL(10,2),
    available_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
    available_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00"}'::jsonb,
    max_patients_per_day INTEGER DEFAULT 20,
    average_consultation_time INTEGER DEFAULT 30,
    rating DECIMAL(2,1) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    bio TEXT,
    languages TEXT[] DEFAULT ARRAY['english'],
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_doctors_user_id` ON user_id
- `idx_doctors_department_id` ON department_id
- `idx_doctors_specialty` ON specialty
- `idx_doctors_is_available` ON is_available

---

#### 3. `appointments`
All appointment bookings.

```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id),
    slot_id UUID REFERENCES slots(id),
    date DATE NOT NULL,
    time TIME NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')),
    chief_complaint TEXT,
    diagnosis TEXT,
    prescription TEXT,
    notes TEXT,
    no_show_risk_score DECIMAL(3,2),
    video_room_url TEXT,
    video_room_name TEXT,
    checked_in_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_appointments_patient_id` ON patient_id
- `idx_appointments_doctor_date` ON (doctor_id, date)
- `idx_appointments_date_status` ON (date, status)
- `idx_appointments_token` ON token

**RLS Policies:**
- Patients can view own appointments
- Doctors can view/update their appointments
- Patients can create appointments
- Patients can cancel own appointments

---

#### 4. `departments`
Hospital departments.

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    capacity INTEGER DEFAULT 50,
    floor_number INTEGER,
    contact_email TEXT,
    contact_phone TEXT,
    head_doctor_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Public read access

---

#### 5. `slots`
Doctor availability slots.

```sql
CREATE TABLE slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    max_patients INTEGER DEFAULT 1,
    current_patients INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, date, start_time)
);
```

**Indexes:**
- `idx_slots_doctor_date` ON (doctor_id, date)
- `idx_slots_is_available` ON is_available

---

#### 6. `prescriptions`
Medical prescriptions.

```sql
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id),
    patient_id UUID NOT NULL REFERENCES users(id),
    medications JSONB NOT NULL,
    instructions TEXT,
    notes TEXT,
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- Patients can view own prescriptions
- Doctors can create/view prescriptions

---

#### 7. `medical_records`
Patient medical history.

```sql
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    record_type TEXT NOT NULL 
        CHECK (record_type IN ('lab_report', 'imaging', 'consultation', 'procedure', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    recorded_date DATE NOT NULL,
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Management Tables

#### 8. `queue`
Real-time patient queue management.

```sql
CREATE TABLE queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' 
        CHECK (status IN ('waiting', 'called', 'in-progress', 'completed', 'no-show')),
    called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appointment_id)
);
```

**Indexes:**
- `idx_queue_status` ON status
- `idx_queue_position` ON position

**Triggers:**
- Auto-update queue positions on insert/update/delete

---

#### 9. `notifications`
Push notifications and alerts.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    fcm_message_id TEXT,
    read BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 10. `otp_verifications`
OTP codes for authentication.

```sql
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,  -- email or phone
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_otp_identifier` ON identifier
- `idx_otp_expires_at` ON expires_at
- `idx_otp_verified` ON verified

**RLS:** Disabled (backend uses service role key)

---

### Analytics & Monitoring Tables

#### 11. `analytics_events`
System analytics and tracking.

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    user_id UUID REFERENCES users(id),
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 12. `audit_logs`
Comprehensive audit trail.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Admin-only access

---

#### 13. `system_alerts`
System monitoring and alerts.

```sql
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('error', 'warning', 'info', 'success')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' 
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source TEXT,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Admin Tables

#### 14. `system_settings`
System-wide configuration.

```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 15. `appointment_rules`
Appointment governance rules.

```sql
CREATE TABLE appointment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT NOT NULL 
        CHECK (rule_type IN ('booking', 'cancellation', 'no_show', 'capacity', 'time_slot')),
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Database Functions

### 1. `generate_daily_slots()`
Auto-generate appointment slots for a doctor.

```sql
CREATE OR REPLACE FUNCTION generate_daily_slots(
    p_doctor_id UUID,
    p_date DATE,
    p_slot_duration INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
-- Generates time slots based on doctor's available hours
$$;
```

**Usage:**
```sql
SELECT generate_daily_slots('doctor-uuid', '2026-06-10', 30);
```

---

### 2. `update_queue_positions()`
Automatically recalculate queue positions.

```sql
CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS TRIGGER AS $$
-- Trigger function to maintain queue order
$$;
```

**Trigger:**
```sql
CREATE TRIGGER update_queue_positions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON queue
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_queue_positions();
```

---

### 3. `update_updated_at_column()`
Auto-update `updated_at` timestamp.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
```

**Applied to:**
- users
- appointments
- doctors
- departments
- prescriptions
- queue
- system_settings
- appointment_rules

---

## Database Views

### 1. `appointment_stats`
Appointment statistics by date.

```sql
CREATE VIEW appointment_stats AS
SELECT 
    date,
    COUNT(*) as total_appointments,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'no-show') as no_shows,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    AVG(no_show_risk_score) as avg_risk_score
FROM appointments
GROUP BY date
ORDER BY date DESC;
```

---

### 2. `doctor_performance`
Doctor performance metrics.

```sql
CREATE VIEW doctor_performance AS
SELECT 
    d.id,
    d.name,
    d.specialty,
    COUNT(a.id) as total_appointments,
    COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
    AVG(dr.rating) as average_rating,
    COUNT(dr.id) as total_reviews
FROM doctors d
LEFT JOIN appointments a ON d.id = a.doctor_id
LEFT JOIN doctor_reviews dr ON d.id = dr.doctor_id
GROUP BY d.id, d.name, d.specialty;
```

---

### 3. `queue_status`
Real-time queue with patient/doctor details.

```sql
CREATE VIEW queue_status AS
SELECT 
    q.*,
    a.date,
    a.time,
    u.name as patient_name,
    d.name as doctor_name,
    dept.name as department_name
FROM queue q
JOIN appointments a ON q.appointment_id = a.id
JOIN users u ON a.patient_id = u.id
JOIN doctors d ON a.doctor_id = d.id
JOIN departments dept ON a.department_id = dept.id
ORDER BY q.position;
```

---

## Row Level Security (RLS)

### Enabled Tables
All user-facing tables have RLS enabled:
- users
- appointments
- prescriptions
- medical_records
- doctors
- slots
- queue
- notifications
- audit_logs
- system_settings

### Policy Examples

**Patients can view own appointments:**
```sql
CREATE POLICY "Patients can view own appointments"
    ON appointments FOR SELECT
    USING (patient_id = auth.uid());
```

**Doctors can view assigned appointments:**
```sql
CREATE POLICY "Doctors can view own appointments"
    ON appointments FOR SELECT
    USING (doctor_id IN (
        SELECT id FROM doctors WHERE user_id = auth.uid()
    ));
```

**Admin full access:**
```sql
CREATE POLICY "Admin full access"
    ON users FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
    ));
```

---

## Indexes

### Performance Indexes
```sql
-- Users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Appointments
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, date);
CREATE INDEX idx_appointments_date_status ON appointments(date, status);

-- Queue
CREATE INDEX idx_queue_status ON queue(status);
CREATE INDEX idx_queue_position ON queue(position);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
```

---

## Data Types

### Common JSONB Structures

**medications (in prescriptions):**
```json
[
  {
    "name": "Aspirin",
    "dosage": "100mg",
    "frequency": "Once daily",
    "duration": "30 days"
  }
]
```

**medical_history (in users):**
```json
{
  "conditions": ["Hypertension", "Diabetes"],
  "surgeries": [
    {
      "type": "Appendectomy",
      "date": "2020-05-15"
    }
  ],
  "family_history": {
    "diabetes": true,
    "heart_disease": false
  }
}
```

**available_hours (in doctors):**
```json
{
  "start": "09:00",
  "end": "17:00"
}
```

---

## Database Migrations

### Deployment
```bash
# Execute complete schema
psql $DATABASE_URL < FYP/Database/00_complete_schema.sql

# Or execute individually
psql $DATABASE_URL < FYP/Database/01_patients.sql
psql $DATABASE_URL < FYP/Database/02_doctors.sql
psql $DATABASE_URL < FYP/Database/03_management.sql
psql $DATABASE_URL < FYP/Database/04_admin.sql
psql $DATABASE_URL < FYP/Database/05_otp.sql
```

### Via MONGODB Dashboard
1. Go to SQL Editor
2. Copy content from `00_complete_schema.sql`
3. Paste and click "Run"

---

## Backup & Recovery

### Automatic Backups
MONGODB provides:
- Daily automated backups
- Point-in-time recovery (PITR)
- 7-day retention on free tier

### Manual Backup
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
psql $DATABASE_URL < backup_20260604.sql
```

---

## Performance Optimization

### Implemented
- ✅ Composite indexes on frequently queried columns
- ✅ Partial indexes where applicable
- ✅ JSONB indexing for medical_history
- ✅ Connection pooling (via MONGODB)
- ✅ Query optimization with proper joins

### Monitoring
- Use MONGODB dashboard for query performance
- Enable slow query logging
- Monitor index usage

---

## Security

### Implemented
- ✅ Row Level Security (RLS) on all tables
- ✅ Role-based access control
- ✅ Service role key for backend (bypasses RLS)
- ✅ Anon key for frontend (respects RLS)
- ✅ Audit logging for sensitive operations

### Best Practices
- Never expose service role key to frontend
- Always use RLS policies
- Encrypt sensitive data (medical records)
- Regular security audits
- Monitor for SQL injection attempts

---

## Support & Contact

**Project:** INDUS Hospital Management System - Database  
**Version:** 1.0.0  
**Database Provider:** MONGODB (MongoDB 15)  
**Last Updated:** June 2026
