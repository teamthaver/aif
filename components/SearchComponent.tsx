'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Writes ?search= to the URL (and resets to page 1). The server page reads it, so results are real
// and shareable.
export default function SearchComponent({ placeholder = 'Search' }: { placeholder?: string }) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const [value, setValue] = useState(params.get('search') ?? '');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('search', value.trim());
      else next.delete('search');
      next.delete('page');
      router.replace(`${path}${next.size ? `?${next}` : ''}`);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-8"
        maxLength={100}
      />
    </div>
  );
}
