import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeCodeService } from '../../server/auth/codeService';
import { FirestoreCodeStore } from '../../server/auth/firestoreStore';
import { makeHandlers } from '../../server/auth/handlers';
import { resendSendEmail } from '../../server/auth/email';

const handlers = makeHandlers({
  service: makeCodeService(new FirestoreCodeStore()),
  sendEmail: resendSendEmail,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { status, body } = await handlers.verifyCode(req.body ?? {});
  res.status(status).json(body);
}
