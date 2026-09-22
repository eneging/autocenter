<?php

namespace App\Mail;

use App\Models\ComplaintBookEntry;
use App\Models\SiteSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ComplaintBookResponseMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ComplaintBookEntry $entry)
    {
    }

    public function build(): self
    {
        $pdf = Pdf::loadView('pdf.complaint-book', [
            'entry' => $this->entry,
            'company' => SiteSetting::current(),
        ])->output();

        return $this
            ->subject('Respuesta a tu '.($this->entry->tipo === 'queja' ? 'queja' : 'reclamo').' N '.$this->entry->code)
            ->view('emails.complaint-book-response')
            ->with(['entry' => $this->entry])
            ->attachData($pdf, 'hoja-reclamacion-'.$this->entry->code.'.pdf', ['mime' => 'application/pdf']);
    }
}
