import React, { createContext, useState, useContext, ReactNode, useCallback, useMemo } from 'react';
import type { Doctor, Patient, Appointment } from '@/integrations/supabase/types';

// Doctors Context
interface DoctorsContextType {
  doctors: Doctor[];
  setDoctors: (doctors: Doctor[]) => void;
  addDoctor: (doctor: Doctor) => void;
  updateDoctor: (id: string, updates: Partial<Doctor>) => void;
  removeDoctor: (id: string) => void;
  getDoctorById: (id: string) => Doctor | undefined;
}

const DoctorsContext = createContext<DoctorsContextType | undefined>(undefined);

export const DoctorsProvider = ({ children }: { children: ReactNode }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const addDoctor = useCallback((doctor: Doctor) => {
    setDoctors(prev => [...prev, doctor]);
  }, []);

  const updateDoctor = useCallback((id: string, updates: Partial<Doctor>) => {
    setDoctors(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const removeDoctor = useCallback((id: string) => {
    setDoctors(prev => prev.filter(d => d.id !== id));
  }, []);

  const getDoctorById = useCallback((id: string) => {
    return doctors.find(d => d.id === id);
  }, [doctors]);

  const value = useMemo(() => ({
    doctors,
    setDoctors,
    addDoctor,
    updateDoctor,
    removeDoctor,
    getDoctorById,
  }), [doctors, addDoctor, updateDoctor, removeDoctor, getDoctorById]);

  return (
    <DoctorsContext.Provider value={value}>
      {children}
    </DoctorsContext.Provider>
  );
};

export const useDoctorsContext = () => {
  const context = useContext(DoctorsContext);
  if (context === undefined) {
    throw new Error('useDoctorsContext must be used within a DoctorsProvider');
  }
  return context;
};

// Patients Context
interface PatientsContextType {
  patients: Patient[];
  setPatients: (patients: Patient[]) => void;
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  removePatient: (id: string) => void;
  getPatientById: (id: string) => Patient | undefined;
}

const PatientsContext = createContext<PatientsContextType | undefined>(undefined);

export const PatientsProvider = ({ children }: { children: ReactNode }) => {
  const [patients, setPatients] = useState<Patient[]>([]);

  const addPatient = useCallback((patient: Patient) => {
    setPatients(prev => [...prev, patient]);
  }, []);

  const updatePatient = useCallback((id: string, updates: Partial<Patient>) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removePatient = useCallback((id: string) => {
    setPatients(prev => prev.filter(p => p.id !== id));
  }, []);

  const getPatientById = useCallback((id: string) => {
    return patients.find(p => p.id === id);
  }, [patients]);

  const value = useMemo(() => ({
    patients,
    setPatients,
    addPatient,
    updatePatient,
    removePatient,
    getPatientById,
  }), [patients, addPatient, updatePatient, removePatient, getPatientById]);

  return (
    <PatientsContext.Provider value={value}>
      {children}
    </PatientsContext.Provider>
  );
};

export const usePatientsContext = () => {
  const context = useContext(PatientsContext);
  if (context === undefined) {
    throw new Error('usePatientsContext must be used within a PatientsProvider');
  }
  return context;
};

// Appointments Context
interface AppointmentsContextType {
  appointments: Appointment[];
  setAppointments: (appointments: Appointment[]) => void;
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  getAppointmentById: (id: string) => Appointment | undefined;
  getAppointmentsByDate: (date: string) => Appointment[];
  getAppointmentsByDoctor: (doctorId: string) => Appointment[];
  getAppointmentsByPatient: (patientId: string) => Appointment[];
}

const AppointmentsContext = createContext<AppointmentsContextType | undefined>(undefined);

export const AppointmentsProvider = ({ children }: { children: ReactNode }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const addAppointment = useCallback((appointment: Appointment) => {
    setAppointments(prev => [...prev, appointment]);
  }, []);

  const updateAppointment = useCallback((id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const removeAppointment = useCallback((id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  const getAppointmentById = useCallback((id: string) => {
    return appointments.find(a => a.id === id);
  }, [appointments]);

  const getAppointmentsByDate = useCallback((date: string) => {
    return appointments.filter(a => a.appointment_date === date);
  }, [appointments]);

  const getAppointmentsByDoctor = useCallback((doctorId: string) => {
    return appointments.filter(a => a.doctor_id === doctorId);
  }, [appointments]);

  const getAppointmentsByPatient = useCallback((patientId: string) => {
    return appointments.filter(a => a.patient_id === patientId);
  }, [appointments]);

  const value = useMemo(() => ({
    appointments,
    setAppointments,
    addAppointment,
    updateAppointment,
    removeAppointment,
    getAppointmentById,
    getAppointmentsByDate,
    getAppointmentsByDoctor,
    getAppointmentsByPatient,
  }), [
    appointments,
    addAppointment,
    updateAppointment,
    removeAppointment,
    getAppointmentById,
    getAppointmentsByDate,
    getAppointmentsByDoctor,
    getAppointmentsByPatient,
  ]);

  return (
    <AppointmentsContext.Provider value={value}>
      {children}
    </AppointmentsContext.Provider>
  );
};

export const useAppointmentsContext = () => {
  const context = useContext(AppointmentsContext);
  if (context === undefined) {
    throw new Error('useAppointmentsContext must be used within an AppointmentsProvider');
  }
  return context;
};

// Combined Provider for convenience
export const HospitalDataProvider = ({ children }: { children: ReactNode }) => {
  return (
    <DoctorsProvider>
      <PatientsProvider>
        <AppointmentsProvider>
          {children}
        </AppointmentsProvider>
      </PatientsProvider>
    </DoctorsProvider>
  );
};

// Legacy export for backward compatibility
export const useHospitalData = () => {
  return {
    hospitalName: 'Smart Care Hub',
    setHospitalName: () => { },
  };
};
