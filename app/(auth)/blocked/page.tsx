import { SignOutButton } from '@/components/layout/sign-out-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function BlockedPage() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Organization suspended</CardTitle>
          <CardDescription>
            Your organization is currently suspended, so access is paused. Contact your
            administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
