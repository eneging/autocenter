@php
    $socialIcons = [
        'facebook' => 'https://res.cloudinary.com/dhuggiq9q/image/upload/v1788784693/Logo_de_Facebook_ykfhro.png',
        'instagram' => 'https://res.cloudinary.com/dhuggiq9q/image/upload/f_png,w_200/v1788784732/Instagram_logo_2022_whdcyf.svg',
        'tiktok' => 'https://res.cloudinary.com/dhuggiq9q/image/upload/v1788784762/tiktok-icon2_rto9fa.png',
    ];
    $whatsappIcon = 'https://res.cloudinary.com/dhuggiq9q/image/upload/v1788784789/apps.8453.13655054093851568.4a371b72-2ce8-4bdb-9d83-be49894d3fa0_w6luvo.png';
@endphp
<div class="footer">
    <table class="footer-table">
        <tr>
            <td class="footer-brand">{{ $company->company_name ?? config('app.name') }}</td>
            @foreach (collect($company->social_embeds ?? [])->filter(fn ($embed) => !empty($embed['platform']) && isset($socialIcons[strtolower($embed['platform'])])) as $embed)
                <td class="footer-social">
                    <img src="{{ $socialIcons[strtolower($embed['platform'])] }}" alt="">
                    <span>{{ $embed['platform'] }}</span>
                </td>
            @endforeach
            <td class="footer-contact">
                @if ($company->contact_whatsapp)
                    <img src="{{ $whatsappIcon }}" alt="">
                    <span>{{ $company->contact_whatsapp }}</span>
                @elseif ($company->contact_phone)
                    {{ $company->contact_phone }}
                @endif
            </td>
        </tr>
    </table>
</div>
