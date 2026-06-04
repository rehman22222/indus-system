# Backend API Documentation

## Overview
Node.js + Express REST API for INDUS Hospital Management System.

**Location:** `FYP/Backend/`  
**Port:** http://localhost:5000  
**Framework:** Express.js (ES Modules)  
**Language:** JavaScript (Node.js 18+)  

---

## Tech Stack

### Core
- **Node.js** 18+ - JavaScript runtime
- **Express** 4.18.2 - Web framework
- **ES Modules** - Modern JavaScript modules

### Database & Auth
- **Supabase Client** 2.105.4 - Database & auth
- **PostgreSQL** - Via Supabase
- **JWT** (jsonwebtoken 9.0.2) - Token authentication

### Email & Notifications
- **Resend** 6.12.4 - Email service (OTP delivery)
- **Firebase Admin** 13.10.0 - Push notifications (FCM)

### Security & Middleware
- **Helmet** 7.1.0 - Security headers
- **CORS** 2.8.5 - Cross-origin resource sharing
- **Express Rate Limit** 7.1.5 - Rate limiting
- **Express Validator** 7.0.1 - Input validation

### Utilities
- **Axios** 1.6.7 - HTTP client
- **Compression** 1.7.4 - Response compression
- **Morgan** 1.10.0 - HTTP request logger
- **dotenv** 16.4.5 - Environment variables

---

## Project Structure

```
Backend/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase client setup
│   ├── controllers/
│   │   ├── analytics.controller.js
│   │   ├── appointment.controller.js
│   │   ├── doctor.controller.js
│   │   ├── notification.controller.js
│   │   ├── otp.controller.js
│   │   ├── patient.controller.js
│   │   ├── queue.controller.js
│   │   └── video.controller.js
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js      # Global error handler
│   │   └── validation.js        # Request validation
│   ├── routes/
│   │   ├── analytics.routes.js
│   │   ├── appointment.routes.js
│   │   ├── auth.routes.js       # OTP authentication
│   │   ├── doctor.routes.js
│   │   ├── notification.routes.js
│   │   ├── otp.routes.js
│   │   ├── patient.routes.js
│   │   ├── queue.routes.js
│   │   └── video.routes.js
│   ├── services/
│   │   ├── email.service.js     # Resend email service
│   │   └── otp.service.js       # OTP generation & verification
│   └── server.js                # Express app entry point
├── .env                          # Environment variables
├── package.json                  # Dependencies
└── README.md
```

---

## Environment Variables

**File:** `Backend/.env`

```bash
# Server Configuration
PORT=5000
NODE_ENV=development
OTP_DEV_MODE=true

# Supabase Configuration
SUPABASE_URL=https://vlcbwrfydjjnsjtuismw.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Daily.co Video Configuration
DAILY_API_KEY=your_daily_api_key_here
DAILY_API_URL=https://api.daily.co/v1

# Firebase Cloud Messaging (Optional)
FCM_SERVER_KEY=your_fcm_server_key_here
FCM_PROJECT_ID=your_firebase_project_id_here
FCM_CLIENT_EMAIL=your_firebase_client_email_here
FCM_PRIVATE_KEY=your_firebase_private_key_here

# Email Service (Resend)
RESEND_API_KEY=re_6UC2xirR_Dm4WRNZpjJGyq1Vz5TBGb5Du
OTP_FROM_EMAIL=onboarding@resend.dev
OTP_FROM_NAME=INDUS Hospital
OTP_EXPIRY_MINUTES=10
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_6UC2xirR_Dm4WRNZpjJGyq1Vz5TBGb5Du

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_this_in_production
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Analytics Service URL
ANALYTICS_API_URL=http://localhost:8000

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

---

## API Endpoints

### Authentication (`/api/auth`)

#### POST `/api/auth/send-otp`
Send OTP to user's email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (Dev Mode):**
```json
{
  "success": true,
  "message": "OTP generated successfully (Development Mode)",
  "code": "123456",
  "expiresAt": "2026-06-04T20:36:06.259Z",
  "devMode": true
}
```

**Response (Production):**
```json
{
  "success": true,
  "message": "OTP sent successfully. Please check your email."
}
```

#### POST `/api/auth/verify-otp`
Verify OTP and authenticate user.

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "patient",
    "name": null,
    "is_active": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/resend-otp`
Resend OTP to user.

**Request:**
```json
{
  "email": "user@example.com"
}
```

---

### Doctors (`/api/v1/doctors`)

#### GET `/api/v1/doctors`
Get all active doctors.

**Query Params:**
- `specialty` - Filter by specialty
- `department_id` - Filter by department

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Dr. John Doe",
      "specialty": "Cardiology",
      "department_id": "uuid",
      "consultation_fee": 1500,
      "rating": 4.8,
      "is_available": true
    }
  ]
}
```

#### GET `/api/v1/doctors/:id`
Get doctor details.

#### POST `/api/v1/doctors` (Admin only)
Create new doctor.

---

### Appointments (`/api/v1/appointments`)

#### GET `/api/v1/appointments`
Get appointments (filtered by user role).

**Headers:**
- `Authorization: Bearer <token>`

**Query Params:**
- `patient_id` - Filter by patient
- `doctor_id` - Filter by doctor
- `date` - Filter by date
- `status` - Filter by status

#### POST `/api/v1/appointments`
Book new appointment.

**Request:**
```json
{
  "patient_id": "uuid",
  "doctor_id": "uuid",
  "department_id": "uuid",
  "date": "2026-06-10",
  "time": "10:00:00",
  "chief_complaint": "Chest pain"
}
```

#### PATCH `/api/v1/appointments/:id`
Update appointment status.

---

### Queue (`/api/v1/queue`)

#### GET `/api/v1/queue`
Get current queue status.

#### POST `/api/v1/queue`
Add appointment to queue.

#### PATCH `/api/v1/queue/:id`
Update queue position/status.

---

### Patients (`/api/v1/patients`)

#### GET `/api/v1/patients/:id`
Get patient profile.

#### PATCH `/api/v1/patients/:id`
Update patient profile.

---

### Notifications (`/api/v1/notifications`)

#### POST `/api/v1/notifications/send`
Send push notification.

**Request:**
```json
{
  "user_id": "uuid",
  "title": "Appointment Reminder",
  "body": "Your appointment is in 1 hour",
  "data": {
    "appointment_id": "uuid"
  }
}
```

---

### Video Consultations (`/api/v1/video`)

#### POST `/api/v1/video/create-room`
Create Daily.co video room.

**Request:**
```json
{
  "appointment_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "room_url": "https://indus.daily.co/room-name",
  "room_name": "room-name"
}
```

---

### Analytics (`/api/v1/analytics`)

#### GET `/api/v1/analytics/dashboard`
Get dashboard analytics.

**Response:**
```json
{
  "total_appointments": 1250,
  "completed_today": 45,
  "pending_appointments": 23,
  "no_show_rate": 5.2
}
```

---

## OTP System (Development Mode)

### How It Works

**OTP_DEV_MODE=true (Current):**
1. User enters email
2. Backend generates 6-digit OTP
3. OTP stored in `otp_verifications` table
4. **OTP code returned in API response** (for testing)
5. OTP also printed in console
6. Valid for 10 minutes
7. Max 5 attempts

**Console Output:**
```
============================================================
🔐 DEVELOPMENT MODE - OTP Generated
============================================================
📧 Email: test@example.com
🔑 OTP Code: 438225
⏰ Expires: 2026-06-04T20:36:06.259Z
ℹ️  Use this code to login (valid for 10 minutes)
============================================================
```

**OTP_DEV_MODE=false (Production):**
- Uses Supabase Auth `signInWithOtp()`
- Actual emails sent via Supabase SMTP
- OTP code NOT returned in response
- Must check email for code

---

## Middleware

### Authentication (`auth.js`)
```javascript
// Verify JWT token
export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  // Verify token, attach user to req.user
};
```

**Usage:**
```javascript
router.get('/protected', authMiddleware, controller);
```

### Error Handler (`errorHandler.js`)
```javascript
export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.isOperational = true;
  }
}

export const errorHandler = (err, req, res, next) => {
  // Handle errors globally
};
```

### Rate Limiting
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Services

### Email Service (`email.service.js`)
```javascript
import { Resend } from 'resend';

export async function sendOTPEmail(to, code, name) {
  // Send OTP email via Resend
}

export async function sendAppointmentConfirmation(to, details) {
  // Send appointment confirmation
}
```

### OTP Service (`otp.service.js`)
```javascript
export async function sendOTP(email) {
  // Generate and store OTP
  // Dev mode: return code
  // Prod mode: send via Supabase Auth
}

export async function verifyOTP(email, code) {
  // Verify OTP from database
  // Create/get user
  // Return user object
}
```

---

## Database Access

### Supabase Client
```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**Usage:**
```javascript
// Insert
const { data, error } = await supabaseAdmin
  .from('users')
  .insert({ email, role: 'patient' })
  .select()
  .single();

// Query
const { data, error } = await supabaseAdmin
  .from('appointments')
  .select('*, doctor:doctors(*)')
  .eq('patient_id', userId);

// Update
const { error } = await supabaseAdmin
  .from('appointments')
  .update({ status: 'completed' })
  .eq('id', appointmentId);
```

---

## Running the Backend

### Development
```bash
cd FYP/Backend
npm install
node src/server.js
```
**URL:** http://localhost:5000

### Testing
```bash
# Health check
curl http://localhost:5000/health

# Send OTP
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Verify OTP
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'
```

---

## Security Best Practices

### Implemented
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Rate limiting
- ✅ JWT authentication
- ✅ Input validation
- ✅ Error handling

### Recommendations
- [ ] Use HTTPS in production
- [ ] Rotate JWT secrets regularly
- [ ] Implement refresh tokens
- [ ] Add request logging
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Use environment-specific configs
- [ ] Implement API versioning

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "status": 400,
  "timestamp": "2026-06-04T20:00:00.000Z"
}
```

### HTTP Status Codes
- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **429** - Too Many Requests
- **500** - Internal Server Error

---

## Dependencies

### Production
```json
{
  "@supabase/supabase-js": "^2.105.4",
  "express": "^4.18.2",
  "resend": "^6.12.4",
  "jsonwebtoken": "^9.0.2",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.1.5",
  "dotenv": "^16.4.5"
}
```

---

## Performance Optimization

- ✅ Compression middleware
- ✅ Response caching (where appropriate)
- ✅ Database indexing
- ✅ Connection pooling (Supabase)

---

## Support & Contact

**Project:** INDUS Hospital Management System - Backend  
**Version:** 1.0.0  
**Last Updated:** June 2026
