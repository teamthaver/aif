import { env, isProd } from './env';
import { AppError } from './errors';

// ---- sign-in codes
// -------------------------------------------------------------------------------
// The code is generated and checked by the server; this is only how it reaches the person.
// Wire your email or SMS provider into `providerSender` below. 'console' prints to the server log
// and is for development only.
export type OtpMessage = { email: string; name: string; code: string; expiresInMinutes: number };
export type OtpSender = (m: OtpMessage) => Promise<void> | void;

const providerSender: OtpSender = async () => {
  // e.g. await resend.emails.send({ to: m.email, subject: 'Your sign-in code', text: `Your code is
  // ${m.code}. It expires in ${m.expiresInMinutes} minutes.` })
  throw new AppError(
    'Sign-in codes cannot be delivered: no email or SMS provider is configured (see lib/notify.ts).',
    'INTERNAL',
  );
};
const consoleSender: OtpSender = (m) => {
  console.log(`[otp] ${m.email}: ${m.code} (expires in ${m.expiresInMinutes} min)`);
};

let override: OtpSender | undefined;
export const setOtpSender = (s: OtpSender | undefined) => {
  override = s;
  // tests install a capturing sender here
};

export async function sendOtp(m: OtpMessage) {
  if (override) return override(m);
  const mode = env().OTP_DELIVERY ?? (isProd() ? 'console' : 'console');
  if (mode === 'console') {
    if (isProd())
      console.warn(
        'WARNING: OTP_DELIVERY=console in production prints sign-in codes to the server log. Use a real provider.',
      );
    return consoleSender(m);
  }
  return providerSender(m);
}

// ---- invitations
// ---------------------------------------------------------------------------------
// Replace with an email or SMS provider. Outside production the invite link is also shown in the
// admin UI.
export function notifyInvite(p: {
  email: string;
  name: string;
  orgName: string | null;
  token: string;
}) {
  if (!isProd())
    console.log(
      `[invite] ${p.name} <${p.email}> (${p.orgName ?? 'platform'}): /accept-invite?token=${p.token}`,
    );
}
