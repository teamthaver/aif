import { redirect } from 'next/navigation';
import { getCtxOrRedirect } from '@/lib/sessionCheck';
import { HOME } from '@/lib/rbac';

// Everyone lands in their own panel
export default async function Home() {
  const ctx = await getCtxOrRedirect();
  redirect(HOME[ctx.user.role]);
}
