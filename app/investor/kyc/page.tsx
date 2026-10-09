import Link from 'next/link';
import { CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { KycForm } from '@/components/investor/kyc-form';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { pageData, requireRole } from '@/lib/sessionCheck';
import { getOwnKycAction } from '@/lib/actions/kyc';
import { fmtDate } from '@/lib/format';

// The only page an unverified investor can use. A fresh account lands here on first sign-in.
export default async function Page() {
  const ctx = await requireRole('investor');
  const detail = await pageData(getOwnKycAction());
  if (!detail) return null;
  const banner = {
    not_started: {
      icon: <ShieldAlert className="size-5 text-amber-600" />,
      tone: 'border-amber-300 bg-amber-50',
      text: 'Welcome. Before you can use your account, we need to verify your identity. It takes about 10 minutes and you can save your progress and come back.',
    },
    in_progress: {
      icon: <ShieldAlert className="size-5 text-amber-600" />,
      tone: 'border-amber-300 bg-amber-50',
      text: 'Your verification is not finished yet. Complete every section, upload your documents and submit.',
    },
    submitted: {
      icon: <Clock className="size-5 text-sky-600" />,
      tone: 'border-sky-300 bg-sky-50',
      text: `Submitted ${fmtDate(detail.submittedAt)}. A reviewer is checking your details and documents. You cannot edit them while they are under review.`,
    },
    rejected: {
      icon: <ShieldAlert className="size-5 text-destructive" />,
      tone: 'border-red-300 bg-red-50',
      text: `We could not verify you yet: ${detail.rejectionReason ?? 'please review your details'}. Fix this below and submit again.`,
    },
    verified: {
      icon: <CheckCircle2 className="size-5 text-emerald-600" />,
      tone: 'border-emerald-300 bg-emerald-50',
      text: 'Your identity is verified. You now have full access to your account.',
    },
  }[detail.status];
  return (
    <>
      <PageHeader
        title="KYC verification"
        description="Know-your-customer checks are required by regulation before you can invest."
      >
        {detail.status === 'verified' && (
          <Button asChild>
            <Link href="/investor">Go to my account</Link>
          </Button>
        )}
      </PageHeader>
      <Card className={`flex items-start gap-3 p-4 text-sm ${banner.tone}`}>
        {banner.icon}
        <span>{banner.text}</span>
      </Card>
      <KycForm detail={detail} />
    </>
  );
}
