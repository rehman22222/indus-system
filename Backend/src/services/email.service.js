import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP email using Resend
 */
export const sendOTPEmail = async (to, otp, name = 'User') => {
  try {
    const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || 10;
    const fromName = process.env.OTP_FROM_NAME || 'INDUS Hospital';
    const fromEmail = process.env.OTP_FROM_EMAIL || 'onboarding@resend.dev';

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject: `Your OTP Code: ${otp}`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 10px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #0d6efd; margin-bottom: 8px;">INDUS Hospital</h2>
    <p style="color: #555;">Hello <strong>${name}</strong>,</p>
    <p style="color: #555;">Your One-Time Password (OTP) for verification is:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #0d6efd; background: #e8f0fe; padding: 12px 24px; border-radius: 8px;">
        ${otp}
      </span>
    </div>
    <p style="color: #888; font-size: 14px;">
      This OTP expires in <strong>${expiryMinutes} minutes</strong>. Do not share it with anyone.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #999; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} INDUS Hospital. All rights reserved.
    </p>
  </div>
</body>
</html>
            `
    });

    if (error) {
      console.error('Resend API error:', error);
      throw error;
    }

    console.log('✅ OTP email sent successfully:', data?.id);
    return data;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

/**
 * Send appointment confirmation email
 */
export const sendAppointmentConfirmation = async (to, appointmentDetails) => {
  try {
    const fromName = process.env.OTP_FROM_NAME || 'INDUS Hospital';
    const fromEmail = process.env.OTP_FROM_EMAIL || 'onboarding@resend.dev';

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject: 'Appointment Confirmation - INDUS Hospital',
      html: `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #0d6efd; margin-bottom: 16px;">Appointment Confirmed</h2>
    <p style="color: #555;">Dear <strong>${appointmentDetails.patientName}</strong>,</p>
    <p style="color: #555;">Your appointment has been confirmed with the following details:</p>
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 8px 0;"><strong>Doctor:</strong> ${appointmentDetails.doctorName}</p>
      <p style="margin: 8px 0;"><strong>Department:</strong> ${appointmentDetails.department}</p>
      <p style="margin: 8px 0;"><strong>Date:</strong> ${appointmentDetails.date}</p>
      <p style="margin: 8px 0;"><strong>Time:</strong> ${appointmentDetails.time}</p>
      <p style="margin: 8px 0;"><strong>Token Number:</strong> <span style="color: #0d6efd; font-size: 18px; font-weight: bold;">${appointmentDetails.token}</span></p>
    </div>
    <p style="color: #888; font-size: 14px;">Please arrive 15 minutes early. Bring your ID and any relevant medical records.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="color: #999; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} INDUS Hospital. All rights reserved.
    </p>
  </div>
</body>
</html>
            `
    });

    if (error) {
      console.error('Resend API error:', error);
      throw error;
    }

    console.log('✅ Appointment confirmation email sent:', data?.id);
    return data;
  } catch (error) {
    console.error('Error sending appointment confirmation:', error);
    throw error;
  }
};

