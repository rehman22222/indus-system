# Frontend Web Application Documentation

## Overview
React + Vite + TypeScript web application for INDUS Hospital Management System.

**Location:** `FYP/Frontend/Web/`  
**Port:** http://localhost:5173  
**Framework:** React 18.2.0 + Vite + TypeScript  
**Styling:** Tailwind CSS + shadcn/ui components  

---

## Tech Stack

### Core
- **React** 18.2.0 - UI library
- **TypeScript** 5.5.4 - Type safety
- **Vite** 5.3.4 - Build tool & dev server
- **React Router** 6.23.1 - Client-side routing
- **Tailwind CSS** 3.4.7 - Utility-first styling

### UI Components
- **shadcn/ui** - Reusable components built on Radix UI
- **Lucide React** - Icon library
- **React Hook Form** - Form management
- **Zod** - Schema validation

### State Management
- **React Context API** - Global state (Auth, Hospital Data)
- **Custom Hooks** - Encapsulated logic

### Backend Integration
- **Supabase Client** (@supabase/supabase-js 2.105.4)
- **Axios** - HTTP requests to Node.js backend

---

## Project Structure

```
Frontend/Web/
├── public/              # Static assets
├── src/
│   ├── assets/         # Images, logos
│   ├── components/     # Reusable React components
│   │   ├── admin/      # Admin dashboard components
│   │   ├── auth/       # Authentication components (OTP)
│   │   ├── doctor/     # Doctor portal components
│   │   ├── patient/    # Patient portal components
│   │   ├── shared/     # Shared components
│   │   └── ui/         # shadcn/ui base components
│   ├── contexts/       # React Context providers
│   │   └── AuthContext.tsx
│   ├── hooks/          # Custom React hooks
│   │   ├── useOTP.ts
│   │   ├── useCountdown.ts
│   │   ├── useAuth.tsx
│   │   └── ...
│   ├── lib/            # Utility functions
│   ├── pages/          # Page components
│   │   ├── PatientApp.tsx
│   │   ├── DoctorDashboard.tsx
│   │   └── AdminDashboard.tsx
│   ├── services/       # API service layer
│   │   └── otpService.ts
│   ├── types/          # TypeScript type definitions
│   │   └── auth.types.ts
│   ├── App.tsx         # Root component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── .env                # Environment variables
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── tailwind.config.js  # Tailwind configuration
└── vite.config.ts      # Vite configuration
```

---

## Environment Variables

**File:** `Frontend/Web/.env`

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://vlcbwrfydjjnsjtuismw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend API
VITE_API_BASE_URL=http://localhost:5000

# App Configuration
VITE_APP_NAME=INDUS Hospital Management System
```

---

## Key Features

### 1. Authentication System (OTP-based)
**Files:**
- `src/contexts/AuthContext.tsx` - Auth state management
- `src/services/otpService.ts` - OTP API calls
- `src/components/auth/OtpInput.tsx` - 6-digit OTP input
- `src/hooks/useOTP.ts` - OTP logic hook
- `src/hooks/useCountdown.ts` - Timer for OTP expiry

**Flow:**
1. User enters email
2. Backend sends 6-digit OTP
3. User enters OTP
4. Backend verifies & creates JWT token
5. User redirected based on role (patient/doctor/admin/management)

### 2. Patient Portal
**Components:**
- `PatientAuthScreen.tsx` - Login/signup
- `AppointmentBooking.tsx` - Book appointments
- `AppointmentQRCode.tsx` - QR code for check-in
- `VideoConsultation.tsx` - Video calls with doctors
- `MedicalRecords.tsx` - View prescriptions & history

**Features:**
- Book physical/video appointments
- View appointment history
- Real-time queue updates
- QR code check-in
- Video consultations
- View prescriptions

### 3. Doctor Portal
**Components:**
- `DoctorDashboard.tsx` - Overview & stats
- `PatientQueue.tsx` - Manage queue
- `AppointmentManagement.tsx` - View appointments
- `PrescriptionWriter.tsx` - Write prescriptions

**Features:**
- View daily schedule
- Manage patient queue
- Start video consultations
- Write prescriptions
- View patient medical history

### 4. Admin Dashboard
**Components:**
- `AdminDashboard.tsx` - System overview
- `DoctorManagement.tsx` - Manage doctors
- `MLAnalytics.tsx` - AI/ML analytics
- `AppointmentGovernance.tsx` - Appointment rules

**Features:**
- Manage doctors & departments
- View system analytics
- Monitor no-show predictions
- Configure appointment rules
- Generate reports

---

## API Integration

### Backend API (Node.js)
**Base URL:** `http://localhost:5000`

**Endpoints:**
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/register` - Register user
- `GET /api/v1/doctors` - Get doctors
- `GET /api/v1/appointments` - Get appointments
- `POST /api/v1/appointments` - Create appointment
- `GET /api/v1/queue` - Get queue
- `POST /api/v1/notifications` - Send notification

### Supabase (Direct Database Access)
**Used for:**
- Real-time subscriptions
- Direct table queries (with RLS)
- File storage (avatars, medical records)

---

## Routing

**Main Routes:**
- `/` - Home (redirects based on auth)
- `/login` - Login page (OTP)
- `/signup` - Signup page (OTP)
- `/patient/dashboard` - Patient portal
- `/doctor/dashboard` - Doctor dashboard
- `/admin/dashboard` - Admin panel
- `/management/dashboard` - Management portal

**Protected Routes:**
- Implemented via `AuthContext`
- Role-based access control
- Automatic redirect if unauthorized

---

## State Management

### Auth Context
```typescript
interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

**Storage:** localStorage
- `indus_user` - User object
- `indus_token` - JWT token

---

## Styling

### Tailwind Configuration
**Primary Colors:**
- Primary: `#0d6efd` (Blue)
- Success: `#198754` (Green)
- Danger: `#dc3545` (Red)
- Warning: `#ffc107` (Yellow)

### Custom Animations
```css
@keyframes shake { /* OTP error shake */ }
@keyframes fadeIn { /* Smooth entrance */ }
@keyframes slideUp { /* Modal appearance */ }
```

---

## Running the Application

### Development
```bash
cd FYP/Frontend/Web
npm install
npm run dev
```
**URL:** http://localhost:5173

### Build for Production
```bash
npm run build
npm run preview  # Preview production build
```

### Deployment
```bash
npm run build
# Deploy dist/ folder to hosting (Vercel, Netlify, etc.)
```

---

## Testing

### Manual Testing
1. Start backend: `cd FYP/Backend && node src/server.js`
2. Start frontend: `cd FYP/Frontend/Web && npm run dev`
3. Open http://localhost:5173
4. Test OTP flow with any email (dev mode)

### Browser Requirements
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Known Issues & TODOs

### Current Issues
1. Old password-based auth still in PatientAuthScreen - needs OTP migration
2. Some routes still call Supabase `auth.signUp` instead of OTP API

### TODO
- [ ] Replace password auth with OTP in all components
- [ ] Add form validation with Zod
- [ ] Implement service worker for PWA
- [ ] Add error boundary components
- [ ] Implement analytics tracking
- [ ] Add unit tests with Vitest

---

## Dependencies

### Production
```json
{
  "@supabase/supabase-js": "^2.105.4",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.23.1",
  "react-hook-form": "^7.53.0",
  "zod": "^3.23.8",
  "lucide-react": "^0.439.0",
  "date-fns": "^3.6.0",
  "qrcode.react": "^4.2.0"
}
```

### Development
```json
{
  "@vitejs/plugin-react": "^4.3.1",
  "typescript": "^5.5.4",
  "tailwindcss": "^3.4.7",
  "autoprefixer": "^10.4.19",
  "vite": "^5.3.4"
}
```

---

## Performance Optimization

### Implemented
- ✅ Code splitting with React.lazy()
- ✅ Asset optimization (images, icons)
- ✅ Tailwind CSS purging
- ✅ Vite build optimization

### Recommended
- [ ] Implement virtual scrolling for large lists
- [ ] Add image lazy loading
- [ ] Use React.memo for expensive components
- [ ] Implement service worker caching

---

## Security

### Implemented
- ✅ JWT token storage in localStorage
- ✅ Role-based access control
- ✅ HTTPS in production (recommended)
- ✅ Input sanitization
- ✅ XSS protection via React

### Best Practices
- Never commit `.env` files
- Rotate JWT secrets regularly
- Use HTTPS in production
- Implement rate limiting on API calls
- Validate all user inputs

---

## Support & Contact

**Project:** INDUS Hospital Management System  
**Version:** 1.0.0  
**Last Updated:** June 2026
