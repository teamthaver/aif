// One page of a list, as every list action returns it
export type Paged<T> = { rows: T[]; total: number; page: number; totalPages: number };
