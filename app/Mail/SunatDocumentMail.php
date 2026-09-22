<?php

namespace App\Mail;

use App\Models\SiteSetting;
use App\Models\SunatDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SunatDocumentMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public SunatDocument $document)
    {
    }

    public function build(): self
    {
        $company = SiteSetting::current();
        $tipoLabel = $this->document->tipo === 'factura' ? 'Factura' : 'Boleta';

        return $this
            ->subject("Tu {$tipoLabel} {$this->document->serie}-{$this->document->numero} - ".($company->company_name ?? 'Segmentos'))
            ->view('emails.sunat-document')
            ->with(['document' => $this->document, 'company' => $company, 'tipoLabel' => $tipoLabel]);
    }
}
