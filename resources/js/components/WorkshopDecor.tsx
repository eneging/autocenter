import { BatteryCharging, Car, Cog, Gauge, Wrench, Zap } from 'lucide-react';
import React from 'react';

const ICONS = [Car, BatteryCharging, Gauge, Cog, Wrench, Zap];

/**
 * Textura de fondo decorativa (herramientas y piezas de un taller automotriz) para
 * secciones con mucho espacio vacio. Puramente visual: pointer-events off
 * y aria-hidden para que no estorbe a lectores de pantalla ni clics.
 */
export function WorkshopDecor({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  return (
    <div className={`workshop-decor workshop-decor-${variant}`} aria-hidden="true">
      {ICONS.map((Icon, index) => (
        <Icon key={index} className={`workshop-decor-icon workshop-decor-icon-${index + 1}`} />
      ))}
    </div>
  );
}
