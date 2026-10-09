'use client';
import { toast } from 'sonner';

// Development only: in production the server never returns the token and your email provider
// delivers the link.
export function showInviteLink(email: string, token?: string) {
  if (!token) return;
  const url = `${location.origin}/accept-invite?token=${token}`;
  toast.info(`Invite link for ${email}: ${url}`, {
    duration: Infinity,
    closeButton: true,
    action: { label: 'Copy link', onClick: () => navigator.clipboard.writeText(url) },
  });
}
