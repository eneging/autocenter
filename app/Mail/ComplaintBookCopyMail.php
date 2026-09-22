<?php

namespace App\Mail;

use App\Models\ComplaintBookEntry;
use App\Models\SiteSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ComplaintBookCopyMail extends Mailable
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
            ->subject('Copia de tu Hoja de Reclamacion N '.$this->entry->code)
            ->view('emails.complaint-book-copy')
            ->with(['entry' => $this->entry])
            ->attachData($pdf, 'hoja-reclamacion-'.$this->entry->code.'.pdf', ['mime' => 'application/pdf']);
    }
}
