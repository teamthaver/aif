import { ShieldCheck } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { redirectIfSignedIn } from '@/lib/sessionCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

// One shared sign-in for organization admins, fund managers, compliance managers, auditors and
// investors. The role is read from the database after sign-in and the person is sent to their own
// panel.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string; reason?: string }>;
}) {
  const { activated, reason } = await searchParams;
  await redirectIfSignedIn();
  const note =
    reason === 'expired'
      ? 'Your session has ended. Please sign in again.'
      : activated
        ? 'Your account is ready. Sign in to continue.'
        : 'Use the email your invite was sent to.';
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
            ThaverTech
          </div>
          <CardTitle className="text-xl">Sign in</CardTitle>
          <CardDescription className={reason === 'expired' ? 'font-medium text-amber-700' : ''}>
            {note}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm portal="org" />
        </CardContent>
      </Card>
    </div>
  );
}
