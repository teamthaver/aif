'use client';
import { toast } from 'sonner';

// navigator.clipboard only exists on HTTPS (or localhost), so fall back to the older copy command
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the fallback below
  }
  const box = document.createElement('textarea');
  box.value = text;
  box.style.position = 'fixed';
  box.style.opacity = '0';
  document.body.appendChild(box);
  box.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(box);
  return copied;
}

export function showInviteLink(email: string, token?: string) {
  if (!token) return;
  const url = `${location.origin}/accept-invite?token=${token}`;
  toast.info(`Invite link for ${email}: ${url}`, {
    duration: Infinity,
    closeButton: true,
    action: {
      label: 'Copy',
      onClick: async () => {
        const ok = await copyText(url);
        if (ok) toast.success('Link copied');
        else toast.error('Could not copy. Select the link and copy it by hand.');
      },
    },
  });
}