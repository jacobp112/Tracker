import { Resend } from 'resend';
import type { SendEmail } from './handlers';

/** Real Resend-backed sender. Requires RESEND_API_KEY + RESEND_FROM. */
export const resendSendEmail: SendEmail = async (to, code) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: 'Your Cairn verification code',
    html: `<div style="font-family:Figtree,Arial,sans-serif;color:#1a1a1a">
      <p>Your Cairn verification code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
      <p style="color:#77776a">It expires in 10 minutes. If you didn't ask for this, ignore this email.</p>
    </div>`,
  });
};
