import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPlateLookupUsage } from '../lib/taller';

/** Cuántas consultas del plan gratuito de placas (json.pe) quedan disponibles este mes. */
export function PlateUsageHint() {
  const { data } = useQuery({
    queryKey: ['plate-lookup-usage'],
    queryFn: getPlateLookupUsage,
    staleTime: 60_000,
    retry: false,
  });

  if (!data) return null;

  return (
    <small className={`plate-usage-hint ${data.remaining <= 0 ? 'is-empty' : data.remaining <= 10 ? 'is-low' : ''}`}>
      {data.remaining <= 0
        ? `Se acabaron las consultas de placas de este mes (${data.limit}). Vuelven a estar disponibles el próximo mes.`
        : `Consultas de placa: ${data.used}/${data.limit} usadas este mes`}
    </small>
  );
}
