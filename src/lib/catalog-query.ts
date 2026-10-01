import { queryOptions } from '@tanstack/react-query';
import { getCatalog } from './catalog.functions';
export const catalogQuery=queryOptions({queryKey:['catalog'],queryFn:()=>getCatalog(),staleTime:60_000});
