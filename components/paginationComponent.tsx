'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Previous / next links that keep the current search. Renders nothing when there is only one page.
export default function Pagination({ totalPages }: { totalPages: number }) {
  const path = usePathname(),
    params = useSearchParams();
  const page = Math.min(Math.max(1, Number(params.get('page')) || 1), totalPages);
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const n = new URLSearchParams(params.toString());
    if (p <= 1) n.delete('page');
    else n.set('page', String(p));
    return `${path}${n.size ? `?${n}` : ''}`;
  };
  const btn = 'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm';
  return (
    <nav className="flex items-center justify-between pt-2" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(btn, 'hover:bg-muted')}>
          <ChevronLeft className="size-4" />
          Previous
        </Link>
      ) : (
        <span className={cn(btn, 'opacity-40')}>
          <ChevronLeft className="size-4" />
          Previous
        </span>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={cn(btn, 'hover:bg-muted')}>
          Next
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(btn, 'opacity-40')}>
          Next
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
