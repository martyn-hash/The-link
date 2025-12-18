import { db } from '../db.js';
import { clientProjectTaskTokens, clientProjectTaskOtps } from '@shared/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';

export async function sendClientTaskOtp(token: string, recipientEmail: string): Promise<{ sent: boolean; error?: string }> {
  if (!recipientEmail) {
    return { sent: false, error: 'No email address available for OTP' };
  }

  const [tokenRecord] = await db
    .select()
    .from(clientProjectTaskTokens)
    .where(eq(clientProjectTaskTokens.token, token));

  if (!tokenRecord) {
    return { sent: false, error: 'Invalid token' };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(clientProjectTaskOtps).values({
    tokenId: tokenRecord.id,
    code,
    expiresAt,
  });

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.log(`[ClientTaskOTP] DEV MODE - OTP code for ${recipientEmail}: ${code}`);
      return { sent: true };
    }

    const sendgrid = await import('@sendgrid/mail');
    sendgrid.default.setApiKey(process.env.SENDGRID_API_KEY);

    await sendgrid.default.send({
      to: recipientEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@thelink.app',
      subject: 'Your verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Please enter this code to access your client task form:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
            ${code}
          </div>
          <p style="color: #666; margin-top: 20px;">This code expires in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, you can ignore this email.</p>
        </div>
      `,
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    });

    console.log(`[ClientTaskOTP] Sent OTP to ${recipientEmail}`);
    return { sent: true };
  } catch (error: any) {
    console.error('[ClientTaskOTP] Failed to send OTP:', error);
    return { sent: false, error: 'Failed to send verification code' };
  }
}

export async function verifyClientTaskOtp(token: string, code: string): Promise<{ valid: boolean; error?: string }> {
  const [tokenRecord] = await db
    .select()
    .from(clientProjectTaskTokens)
    .where(eq(clientProjectTaskTokens.token, token));

  if (!tokenRecord) {
    return { valid: false, error: 'Invalid token' };
  }

  const [otpRecord] = await db
    .select()
    .from(clientProjectTaskOtps)
    .where(
      and(
        eq(clientProjectTaskOtps.tokenId, tokenRecord.id),
        eq(clientProjectTaskOtps.code, code),
        isNull(clientProjectTaskOtps.usedAt),
        gt(clientProjectTaskOtps.expiresAt, new Date())
      )
    );

  if (!otpRecord) {
    const [expiredOtp] = await db
      .select()
      .from(clientProjectTaskOtps)
      .where(
        and(
          eq(clientProjectTaskOtps.tokenId, tokenRecord.id),
          eq(clientProjectTaskOtps.code, code)
        )
      );

    if (expiredOtp) {
      if (expiredOtp.usedAt) {
        return { valid: false, error: 'This verification code has already been used.' };
      }
      if (expiredOtp.expiresAt && new Date(expiredOtp.expiresAt) < new Date()) {
        return { valid: false, error: 'Verification code expired. Please request a new one.' };
      }
    }
    return { valid: false, error: 'Invalid verification code' };
  }

  await db
    .update(clientProjectTaskOtps)
    .set({ usedAt: new Date() })
    .where(eq(clientProjectTaskOtps.id, otpRecord.id));

  await db
    .update(clientProjectTaskTokens)
    .set({ otpVerifiedAt: new Date() })
    .where(eq(clientProjectTaskTokens.id, tokenRecord.id));

  console.log(`[ClientTaskOTP] Verified OTP for token ${token.substring(0, 8)}...`);
  return { valid: true };
}
