<?php

namespace App\Mail;

use App\Models\Quotation;
use App\Models\SiteSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class QuotationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Quotation $quotation)
    {
    }

    public function build(): self
    {
        $company = SiteSetting::current();

        $pdf = Pdf::loadView('pdf.quotation', [
            'quotation' => $this->quotation,
            'company' => $company,
        ])->output();

        return $this
            ->subject('Tu cotizacion '.$this->quotation->number.' - '.($company->company_name ?? 'Segmentos'))
            ->view('emails.quotation')
            ->with(['quotation' => $this->quotation, 'company' => $company])
            ->attachData($pdf, $this->quotation->number.'.pdf', ['mime' => 'application/pdf']);
    }
}
