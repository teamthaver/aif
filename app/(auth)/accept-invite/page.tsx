import { AcceptInviteForm } from '@/components/auth/accept-invite-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Set your password</CardTitle>
          <CardDescription>This link works once and expires after 48 hours.</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <AcceptInviteForm token={token} />
          ) : (
            <p className="text-sm text-destructive">
              This link has no invite token. Open the link from your invite message.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
