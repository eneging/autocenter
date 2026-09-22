import { APP_NAME } from '../apiClient';
import { MessageCircle } from 'lucide-react';
import React from 'react';
import { whatsappNumber } from '../lib/publicSite';

export function WhatsAppFloatButton({ phone }: { phone?: string | null }) {
  if (!phone) return null;

  const url = `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(`Hola! Quiero más información sobre ${APP_NAME}.`)}`;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="whatsapp-float" aria-label="Contactar por WhatsApp">
      <span className="whatsapp-float-ping" aria-hidden="true" />
      <MessageCircle size={26} strokeWidth={2.2} />
    </a>
  );
}
