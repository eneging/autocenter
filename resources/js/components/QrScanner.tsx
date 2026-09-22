import { Html5Qrcode } from 'html5-qrcode';
import { CameraOff } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Lector de códigos QR con la cámara (funciona en móviles y escritorio, requiere HTTPS o localhost).
 * Evita lecturas repetidas del mismo código durante `cooldownMs`.
 */
export function QrScanner({ onScan, active = true, cooldownMs = 2500 }: { onScan: (text: string) => void; active?: boolean; cooldownMs?: number }) {
  const elementId = `qr-reader-${useId().replace(/:/g, '')}`;
  const [error, setError] = useState<string | null>(null);
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let last = { text: '', at: 0 };
    const scanner = new Html5Qrcode(elementId, { verbose: false });

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          const now = Date.now();
          if (text === last.text && now - last.at < cooldownMs) return;
          last = { text, at: now };
          handler.current(text);
        },
        () => undefined,
      )
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo acceder a la cámara.');
      });

    return () => {
      cancelled = true;

      const release = () => {
        try {
          scanner.clear();
        } catch {
          // ya liberado
        }
      };

      // stop() lanza de forma síncrona si el lector nunca llegó a arrancar (p. ej. sin permiso de cámara);
      // sin este try/catch esa excepción tumba toda la aplicación al cambiar de pantalla.
      try {
        scanner.stop().then(release, release);
      } catch {
        release();
      }
    };
  }, [active, elementId, cooldownMs]);

  if (error) {
    return (
      <div className="qr-error">
        <CameraOff size={22} />
        <p>No pudimos usar la cámara: {error}</p>
        <small>Revisa el permiso de cámara del navegador o ingresa el código manualmente.</small>
      </div>
    );
  }

  return <div id={elementId} className="qr-reader" />;
}
