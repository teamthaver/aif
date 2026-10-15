import { ShieldAlert } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { redirectIfSignedIn } from '@/lib/sessionCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

// The system administrator's own sign-in. It sits outside the (panel) group, so it is not behind
// the system layout's session check.
export default async function SystemLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  await redirectIfSignedIn();
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
            <Image
              src={"/images/logo.png"}
              height={28}
              width={28}
              alt='Logo'
            />
            ThaverTech: system administration
          </div>
          <CardTitle className="text-xl">System admin sign in</CardTitle>
          <CardDescription className={reason === 'expired' ? 'font-medium text-amber-700' : ''}>
            {reason === 'expired'
              ? 'Your session has ended. Please sign in again.'
              : 'For platform administrators only. Organization users sign in at the main login page.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm portal="system" />
        </CardContent>
      </Card>
    </div>
  );
}
