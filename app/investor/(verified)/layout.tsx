import { requireVerifiedInvestor } from '@/lib/sessionCheck';

// Everything inside this group needs verified KYC. Anyone else is sent to the KYC page.
export default async function VerifiedLayout({ children }: { children: React.ReactNode }) {
  await requireVerifiedInvestor();
  return children;
}
