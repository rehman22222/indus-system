# Mobile App Documentation (React Native)

## Overview

The INDUS Hospital Management System mobile app is built with **React Native** and supports both native mobile platforms (iOS/Android) and web deployment. It provides a unified mobile experience for patients and doctors to manage appointments, view medical records, and access hospital services on the go.

## Technology Stack

### Core Technologies
- **React Native 0.85.3** - Cross-platform mobile framework
- **React 18.2.0** - UI library
- **React Navigation 6.x** - Navigation framework
- **TypeScript 5.5.4** - Type-safe development

### UI Components
- **Radix UI** - Accessible UI primitives
- **Lucide React** - Icon library
- **TailwindCSS 3.4.7** - Utility-first CSS
- **React Native Web** - Web compatibility layer

### Backend Integration
- **Supabase Client 2.105.4** - Database and auth
- **React Hook Form 7.53.0** - Form management
- **Zod 3.23.8** - Schema validation

### Build Tools
- **Webpack 5.93.0** - Web bundler
- **Babel 7.x** - JavaScript transpiler
- **Jest 29.7.0** - Testing framework

## Project Structure

```
FYP/Frontend/App/
├── src/
│   ├── screens/                  # Main application screens
│   │   ├── LoginScreen.tsx          # Login/signup entry point
│   │   ├── PatientDashboard.tsx     # Patient home screen
│   │   ├── DoctorDashboard.tsx      # Doctor home screen
│   │   └── appointment/             # Appointment booking flow
│   │       ├── SpecialtySelection.tsx   # Select medical specialty
│   │       ├── DoctorSelection.tsx      # Select doctor
│   │       ├── SlotSelection.tsx        # Select time slot
│   │       └── Confirmation.tsx         # Booking confirmation
│   │
│   ├── components/               # Reusable UI components
│   │   ├── ui/                      # Base UI components (button, card, input, etc.)
│   │   ├── patient/                 # Patient-specific components
│   │   │   ├── PatientAuthScreen.tsx   # Auth form component
│   │   │   └── ForgotPassword.tsx      # Password reset
│   │   └── shared/                  # Shared components
│   │       └── DashboardLayout.tsx     # Common layout wrapper
│   │
│   ├── navigation/               # Navigation configuration
│   │   └── AppNavigator.tsx         # Main navigation stack
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.tsx              # Authentication hook
│   │   └── useAppointments.tsx      # Appointment management
│   │
│   ├── auth/                     # Authentication utilities
│   │   └── authStore.ts             # In-memory auth state
│   │
│   ├── integrations/             # External service integrations
│   │   └── supabase/
│   │       ├── client.ts            # Supabase client setup
│   │       └── types.ts             # Database type definitions
│   │
│   ├── types/                    # TypeScript type definitions
│   │   └── appointment.types.ts     # Appointment interfaces
│   │
│   ├── assets/                   # Static assets (images, logos)
│   └── App.tsx                   # Application root component
│
├── public/                       # Web-specific static files
│   └── index.html                   # HTML template for web
│
├── index.web.js                  # Web entry point
├── webpack.config.js             # Webpack configuration for web
├── babel.config.js               # Babel transpiler config
├── metro.config.js               # Metro bundler config (React Native)
├── package.json                  # Dependencies and scripts
└── .env                          # Environment variables
```

## Environment Configuration

### Required Variables

Create `.env` file in `FYP/Frontend/App/`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://vlcbwrfydjjnsjtuismw.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API (if separate)
VITE_API_URL=http://localhost:5000/api
```

### Variable Usage

Environment variables are injected at build time using `webpack.DefinePlugin`:

```javascript
// Access in code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const apiUrl = import.meta.env.VITE_API_URL;
```

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- For native builds: React Native CLI, Xcode (iOS), Android Studio (Android)
- For web only: Just Node.js

### Install Dependencies

```bash
cd FYP/Frontend/App
npm install
```

### Running the Application

#### Web Version (Development)
```bash
npm run web
# Runs on http://localhost:3001
```

#### Native Mobile (iOS)
```bash
npm run ios
# Requires macOS and Xcode
```

#### Native Mobile (Android)
```bash
npm run android
# Requires Android Studio and Android SDK
```

#### Production Web Build
```bash
npm run build:web
# Creates optimized bundle in dist/
```

## Navigation Flow

### Stack Navigation

The app uses React Navigation's Stack Navigator with the following flow:

```
Login Screen
  ├─ Patient Dashboard
  │   └─ Appointment Booking Flow
  │       ├─ Specialty Selection
  │       ├─ Doctor Selection
  │       ├─ Slot Selection
  │       └─ Confirmation
  │
  └─ Doctor Dashboard
      └─ Patient Management
```

### Route Configuration

```typescript
// src/navigation/AppNavigator.tsx
<Stack.Navigator initialRouteName="Login">
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="PatientDashboard" component={PatientDashboard} />
  <Stack.Screen name="DoctorDashboard" component={DoctorDashboard} />
  <Stack.Screen name="SpecialtySelection" component={SpecialtySelectionScreen} />
  <Stack.Screen name="DoctorSelection" component={DoctorSelectionScreen} />
  <Stack.Screen name="SlotSelection" component={SlotSelectionScreen} />
  <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
</Stack.Navigator>
```

## Key Features

### 1. Authentication System

**Dual Authentication Mode:**
- **Online Mode**: Full Supabase authentication with database sync
- **Demo Mode**: In-memory authentication with mock credentials

```typescript
// useAuth hook provides:
const { 
  user,           // Current user object
  session,        // Auth session
  roles,          // User roles (PATIENT, DOCTOR, ADMIN, etc.)
  signUp,         // Registration function
  signIn,         // Login function
  signOut,        // Logout function
  hasRole,        // Role check function
  isStaff         // Staff check (ADMIN, DOCTOR, MANAGEMENT)
} = useAuth();
```

**Authentication Flow:**
1. User opens LoginScreen
2. Enters credentials or chooses demo mode
3. `useAuth` validates against Supabase or in-memory store
4. On success, navigates to role-based dashboard
5. Session persists via AsyncStorage

### 2. Patient Dashboard

**Features:**
- View upcoming appointments with QR codes
- Book new appointments (multi-step wizard)
- Access medical records and prescriptions
- View queue status and wait times
- Notification center

**UI Components:**
- Appointment cards with status badges
- Quick action buttons
- Real-time queue updates
- Medical record timeline

### 3. Doctor Dashboard

**Features:**
- Today's appointment list
- Patient queue management
- Video consultation access
- Prescription writing
- Patient medical history viewer

**UI Components:**
- Appointment list with patient info
- Queue management controls
- Quick stats cards
- Action buttons (start consultation, prescribe, etc.)

### 4. Appointment Booking Flow

**4-Step Wizard:**

**Step 1: Specialty Selection**
- Display all medical departments
- Grid or list view of specialties
- Search and filter capabilities

**Step 2: Doctor Selection**
- Show available doctors in selected specialty
- Display doctor info (name, qualification, fee)
- View doctor schedules

**Step 3: Slot Selection**
- Calendar view of available dates
- Time slot picker for selected date
- Real-time availability check

**Step 4: Confirmation**
- Review booking details
- Generate QR code for check-in
- Receive confirmation notification

```typescript
// Navigation between steps
navigation.navigate('SpecialtySelection');
navigation.navigate('DoctorSelection', { specialtyId });
navigation.navigate('SlotSelection', { doctorId });
navigation.navigate('Confirmation', { appointmentId });
```

### 5. UI Component Library

**Base Components** (from `components/ui/`):
- `Button` - Primary, secondary, outline variants
- `Card` - Content containers with header/footer
- `Input` - Text input with validation
- `Label` - Form labels
- `Badge` - Status indicators
- `Dialog` - Modal dialogs
- `Calendar` - Date picker
- `Select` - Dropdown selection

**Usage Example:**
```typescript
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

<Card className="p-4">
  <Button variant="default" onClick={handleSubmit}>
    Book Appointment
  </Button>
</Card>
```

## API Integration

### Supabase Client Setup

```typescript
// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### Database Queries

**Fetch Appointments:**
```typescript
const { data, error } = await supabase
  .from('appointments')
  .select('*, doctors(*), patients(*)')
  .eq('patient_id', userId)
  .order('appointment_date', { ascending: true });
```

**Create Appointment:**
```typescript
const { data, error } = await supabase
  .from('appointments')
  .insert({
    patient_id: userId,
    doctor_id: doctorId,
    appointment_date: date,
    time_slot: slot,
    status: 'scheduled'
  })
  .select()
  .single();
```

### REST API Calls (Node.js Backend)

```typescript
// Call Node.js Express backend
const response = await fetch('http://localhost:5000/api/appointments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(appointmentData)
});

const result = await response.json();
```

## Webpack Configuration

### Web Build Strategy

The app uses Webpack to bundle React Native code for web deployment:

**Key Features:**
- React Native Web aliasing (`react-native` → `react-native-web`)
- Environment variable injection (`DefinePlugin`)
- Code splitting (vendor chunks, React Native Web chunk)
- CSS processing with PostCSS and Tailwind
- Terser minification for production
- Gzip compression for assets

**Bundle Optimization:**
```javascript
splitChunks: {
  cacheGroups: {
    reactNativeWeb: {
      test: /[\\/]node_modules[\\/]react-native-web[\\/]/,
      name: 'react-native-web',
      priority: 30
    },
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
      name: 'react-vendor',
      priority: 20
    },
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      priority: 10
    }
  }
}
```

### Development Server

```javascript
devServer: {
  port: 3001,
  hot: true,
  historyApiFallback: true,  // SPA routing support
  compress: true,
  allowedHosts: 'all'
}
```

## Styling with TailwindCSS

### Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0d6efd',
        destructive: '#dc3545',
        // ... custom colors
      }
    }
  }
}
```

### Usage in Components

```typescript
<View className="flex-1 bg-background p-4">
  <Text className="text-2xl font-bold text-foreground">
    Welcome
  </Text>
  <Button className="mt-4 rounded-xl h-11">
    Get Started
  </Button>
</View>
```

## Testing

### Unit Testing with Jest

```bash
npm test
```

**Test Structure:**
```typescript
// __tests__/useAuth.test.ts
import { renderHook } from '@testing-library/react-hooks';
import { useAuth } from '@/hooks/useAuth';

test('should login successfully', async () => {
  const { result } = renderHook(() => useAuth());
  
  await act(async () => {
    await result.current.signIn('test@example.com', 'password');
  });
  
  expect(result.current.user).toBeTruthy();
});
```

### Component Testing

```typescript
// __tests__/LoginScreen.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import LoginScreen from '@/screens/LoginScreen';

test('renders login form', () => {
  const { getByPlaceholderText } = render(<LoginScreen />);
  
  expect(getByPlaceholderText('Email')).toBeTruthy();
  expect(getByPlaceholderText('Password')).toBeTruthy();
});
```

## Type Definitions

### User Types

```typescript
// src/integrations/supabase/types.ts
export type UserRole = 
  | 'PATIENT' 
  | 'DOCTOR' 
  | 'ADMIN' 
  | 'MANAGEMENT' 
  | 'RECEPTIONIST';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string;
}
```

### Appointment Types

```typescript
// src/types/appointment.types.ts
export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  time_slot: string;
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
  queue_number?: number;
  notes?: string;
}
```

## Performance Optimization

### Bundle Size Optimization
- Code splitting by route and vendor
- Tree shaking unused code
- Lazy loading components
- Image optimization (8KB threshold for inline)

### Runtime Performance
- Memoization with `useMemo` and `useCallback`
- Virtual lists for long scrolling content
- Debounced search inputs
- Optimistic UI updates

### Caching Strategy
- AsyncStorage for auth tokens
- In-memory cache for frequently accessed data
- Stale-while-revalidate for API calls

## Deployment

### Web Deployment

**Build for Production:**
```bash
npm run build:web
```

**Output:** `dist/` folder with static files

**Deploy to:**
- Netlify: `netlify deploy --prod --dir=dist`
- Vercel: `vercel --prod`
- AWS S3: Upload `dist/` contents to S3 bucket

### Mobile App Deployment

**iOS (App Store):**
1. Configure app signing in Xcode
2. Archive the app: `xcodebuild archive`
3. Upload to App Store Connect
4. Submit for review

**Android (Google Play):**
1. Generate signing key: `keytool -genkey`
2. Build release APK: `npm run android -- --mode=release`
3. Upload to Google Play Console
4. Submit for review

## Common Development Tasks

### Add New Screen

1. Create screen component in `src/screens/`
2. Register route in `AppNavigator.tsx`
3. Add navigation prop types

```typescript
// src/screens/NewScreen.tsx
import { StackNavigationProp } from '@react-navigation/stack';

type NewScreenProps = {
  navigation: StackNavigationProp<any>;
};

export default function NewScreen({ navigation }: NewScreenProps) {
  return <View>...</View>;
}

// src/navigation/AppNavigator.tsx
<Stack.Screen name="NewScreen" component={NewScreen} />
```

### Add New API Endpoint

1. Create service function
2. Use in component with state management

```typescript
// src/services/api.ts
export async function fetchDoctors() {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('is_active', true);
  
  if (error) throw error;
  return data;
}

// In component
const [doctors, setDoctors] = useState([]);

useEffect(() => {
  fetchDoctors().then(setDoctors);
}, []);
```

### Add New UI Component

1. Create component in `src/components/ui/`
2. Style with TailwindCSS
3. Export from index file

```typescript
// src/components/ui/my-component.tsx
import { View, Text } from 'react-native';

export function MyComponent({ children }: { children: React.ReactNode }) {
  return (
    <View className="p-4 bg-white rounded-lg">
      <Text>{children}</Text>
    </View>
  );
}
```

## Troubleshooting

### Common Issues

**1. Metro Bundler Cache Issues**
```bash
# Clear cache
npx react-native start --reset-cache
```

**2. Webpack Build Errors**
```bash
# Clear webpack cache
rm -rf node_modules/.cache
npm run build:web
```

**3. Environment Variables Not Loading**
- Ensure `.env` file exists
- Restart dev server after .env changes
- Check webpack.config.js DefinePlugin configuration

**4. iOS Build Fails**
```bash
# Reinstall pods
cd ios && pod install && cd ..
npm run ios
```

**5. Android Build Fails**
```bash
# Clean gradle
cd android && ./gradlew clean && cd ..
npm run android
```

## Security Considerations

### Authentication
- JWT tokens stored securely in AsyncStorage
- Automatic token refresh before expiry
- Logout clears all auth state

### API Communication
- HTTPS only for production
- Auth headers on all protected routes
- Request/response validation with Zod

### Data Storage
- Sensitive data encrypted at rest
- No plaintext passwords
- PII handled per HIPAA compliance

## Future Enhancements

### Planned Features
- Push notifications via Firebase Cloud Messaging
- Biometric authentication (Face ID, Touch ID)
- Offline mode with data sync
- Video consultation integration
- Health data export (PDF reports)
- Multi-language support (English, Urdu)

### Technical Improvements
- Migrate to React Native 0.76+ (New Architecture)
- Implement React Query for data fetching
- Add E2E testing with Detox
- Performance monitoring with Sentry
- Analytics with Firebase Analytics

## Related Documentation

- [Backend API Documentation](./backend.md)
- [Web App Documentation](./web.md)
- [Database Schema Documentation](./database.md)
- [Setup Instructions](../SETUP.txt)

## Support

For issues, questions, or contributions:
- Check existing issues in project repository
- Contact development team
- Review React Native documentation: https://reactnative.dev/
