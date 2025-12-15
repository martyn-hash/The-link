import { db } from '../../db.js';
import { people, pageVisits } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { pageVisitStorage } from '../../storage/pages/index.js';
import type sgMail from '@sendgrid/mail';

const otpCodes = new Map<string, { code: string; expiresAt: Date }>();

export async function sendPageOtp(visitToken: string): Promise<{ sent: boolean; error?: string }> {
  const visit = await pageVisitStorage.getByToken(visitToken);
  if (!visit) {
    return { sent: false, error: 'Invalid visit token' };
  }

  const [person] = await db.select().from(people).where(eq(people.id, visit.personId));
  if (!person) {
    return { sent: false, error: 'Person not found' };
  }

  const email = person.primaryEmail || person.email;
  if (!email) {
    return { sent: false, error: 'No email address available for OTP' };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  otpCodes.set(visitToken, { code, expiresAt });

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log(`[PageOTP] DEV MODE - OTP code for ${email}: ${code}`);
      return { sent: true };
    }

    const sendgrid = await import('@sendgrid/mail');
    sendgrid.default.setApiKey(process.env.SENDGRID_API_KEY);

    await sendgrid.default.send({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@thelink.app',
      subject: 'Your verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
            ${code}
          </div>
          <p style="color: #666; margin-top: 20px;">This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, you can ignore this email.</p>
        </div>
      `,
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    });

    console.log(`[PageOTP] Sent OTP to ${email}`);
    return { sent: true };
  } catch (error: any) {
    console.error('[PageOTP] Failed to send OTP:', error);
    return { sent: false, error: 'Failed to send verification code' };
  }
}

export async function verifyPageOtp(visitToken: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const stored = otpCodes.get(visitToken);

  if (!stored) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  if (stored.expiresAt < new Date()) {
    otpCodes.delete(visitToken);
    return { valid: false, error: 'Verification code expired. Please request a new one.' };
  }

  if (stored.code !== code) {
    return { valid: false, error: 'Invalid verification code' };
  }

  otpCodes.delete(visitToken);

  const visit = await pageVisitStorage.getByToken(visitToken);
  if (visit) {
    await pageVisitStorage.update(visit.id, {
      otpVerifiedAt: new Date(),
    });
  }

  console.log(`[PageOTP] Verified OTP for visit ${visitToken}`);
  return { valid: true };
}

export function clearExpiredOtps(): void {
  const now = new Date();
  for (const [token, data] of otpCodes.entries()) {
    if (data.expiresAt < now) {
      otpCodes.delete(token);
    }
  }
}

setInterval(clearExpiredOtps, 5 * 60 * 1000);
