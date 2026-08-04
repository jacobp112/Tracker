import { makeCodeService } from './codeService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SendEmail {
  (to: string, code: string): Promise<void>;
}

export function makeHandlers(deps: {
  service: ReturnType<typeof makeCodeService>;
  sendEmail: SendEmail;
}) {
  return {
    async sendCode(body: { email?: string }) {
      const email = (body.email ?? '').trim();
      if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'Enter a valid email.' } };
      const code = await deps.service.issue(email);
      await deps.sendEmail(email, code);
      return { status: 200, body: { ok: true } };
    },
    async verifyCode(body: { email?: string; code?: string }) {
      const email = (body.email ?? '').trim();
      const code = (body.code ?? '').trim();
      if (!EMAIL_RE.test(email) || code.length !== 6) {
        return { status: 400, body: { error: 'Enter the 6-digit code.' } };
      }
      const result = await deps.service.check(email, code);
      if (result.ok) return { status: 200, body: { ok: true } };
      const messages: Record<string, string> = {
        expired: 'Code expired — resend a new one.',
        'too-many': 'Too many attempts. Resend a new code.',
        mismatch: "That code doesn't look right.",
        missing: 'No code pending — resend one.',
      };
      return { status: 401, body: { error: messages[result.reason] } };
    },
  };
}
