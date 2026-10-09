'use client';
import { LogOut } from 'lucide-react';
import { logoutAction } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';

// `to` is the login page for this person: /system/login for the system admin, /login for everyone
// else
export function SignOutButton({ to = '/login' }: { to?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await logoutAction();
        window.location.assign(to);
      }}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
