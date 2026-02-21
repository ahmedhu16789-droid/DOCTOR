import React, { useEffect, useState } from 'react';
import {
  PatientPortalAppointment,
  PatientPortalVisit,
  patientPortalCancelAppointment,
  patientPortalDownloadPrescriptionUrl,
  patientPortalLogin,
  patientPortalMe,
  patientPortalRescheduleAppointment,
  patientPortalUpcomingAppointments,
  patientPortalVisitHistory,
} from './api';

export function PatientPortalApp() {
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [appointments, setAppointments] = useState<PatientPortalAppointment[]>([]);
  const [visits, setVisits] = useState<PatientPortalVisit[]>([]);

  const loadPortal = async () => {
    const me = await patientPortalMe();
    setPatientName(me.data.name);
    const upcoming = await patientPortalUpcomingAppointments();
    setAppointments(upcoming.data);
    const history = await patientPortalVisitHistory();
    setVisits(history.data);
  };

  useEffect(() => {
    loadPortal().catch(() => setPatientName(''));
  }, []);

  if (!patientName) {
    return (
      <div style={{ maxWidth: 420, margin: '3rem auto' }}>
        <h2>Patient Portal Login</h2>
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
        <input placeholder="Portal Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8 }} />
        <button onClick={async () => {
          await patientPortalLogin(phone, password);
          await loadPortal();
        }}>Sign in</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem 2rem' }}>
      <h2>Welcome, {patientName}</h2>

      <section>
        <h3>Upcoming Appointments</h3>
        {appointments.map((appointment) => (
          <div key={appointment.id} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 8 }}>
            <strong>{appointment.date} {appointment.timeSlot}</strong> — Dr. {appointment.doctor.name} ({appointment.branch.name})
            <div>
              {appointment.canReschedule && (
                <button onClick={async () => {
                  await patientPortalRescheduleAppointment(appointment.id, appointment.date, appointment.timeSlot);
                  await loadPortal();
                }}>Reschedule</button>
              )}
              {appointment.canCancel && (
                <button onClick={async () => {
                  await patientPortalCancelAppointment(appointment.id);
                  await loadPortal();
                }} style={{ marginLeft: 8 }}>Cancel</button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3>Visit History</h3>
        {visits.map((visit) => (
          <div key={visit.id} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 8 }}>
            <div>{visit.appointment.date} {visit.appointment.timeSlot} — Dr. {visit.appointment.doctorName}</div>
            <div>Diagnosis: {visit.diagnosis || '-'}</div>
            <div>Plan: {visit.plan || '-'}</div>
            <ul>
              {visit.prescriptions.map((prescription) => (
                <li key={prescription.id}>
                  {prescription.medicationName} ({prescription.dosage || '-'}){' '}
                  <a href={patientPortalDownloadPrescriptionUrl(prescription.id)}>Download</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
