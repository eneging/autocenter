<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MediaAsset;
use App\Models\SiteCatalogItem;
use App\Models\SiteGalleryItem;
use App\Models\SitePartner;
use App\Models\SiteService;
use App\Models\SiteSetting;
use App\Models\SiteTestimonial;
use App\Models\SiteVideo;
use App\Services\CloudinaryUploader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SiteController extends Controller
{
    // Incluye HEIC/HEIF: las fotos que salen directo de un iPhone vienen en ese formato
    // y la regla nativa 'image' de Laravel las rechaza sin avisar por que.
    private const IMAGE_MIMETYPES = 'mimetypes:image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif';

    public function __construct(private readonly CloudinaryUploader $uploader)
    {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'settings' => SiteSetting::current(),
            'services' => SiteService::where('is_active', true)->orderBy('sort_order')->get(),
            'testimonials' => SiteTestimonial::where('is_active', true)->orderBy('sort_order')->get(),
            'gallery' => SiteGalleryItem::where('is_active', true)->orderBy('sort_order')->get(),
            'videos' => SiteVideo::where('is_active', true)->orderBy('sort_order')->get(),
            'catalog' => SiteCatalogItem::where('is_active', true)->orderBy('category')->orderBy('sort_order')->get(),
            'partners' => SitePartner::where('is_active', true)->orderBy('sort_order')->get(),
        ]);
    }

    public function upload(Request $request): JsonResponse
    {
        $request->validate(['image' => ['required', 'file', self::IMAGE_MIMETYPES, 'max:10240']]);

        $url = $this->uploader->upload($request->file('image'), 'segmentos/site');

        return response()->json(['url' => $url]);
    }

    public function uploadHeroImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', self::IMAGE_MIMETYPES, 'max:10240'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $url = $this->uploader->upload($request->file('image'), 'segmentos/site-hero');

        $asset = MediaAsset::create([
            'url' => $url,
            'resource_type' => 'image',
            'label' => $request->input('label'),
        ]);

        return response()->json($asset, 201);
    }

    public function uploadVideo(Request $request): JsonResponse
    {
        $request->validate([
            'video' => ['required', 'file', 'mimetypes:video/mp4,video/quicktime,video/webm,video/x-m4v', 'max:35840'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $url = $this->uploader->upload($request->file('video'), 'segmentos/site-videos', 'video');

        $asset = MediaAsset::create([
            'url' => $url,
            'resource_type' => 'video',
            'label' => $request->input('label'),
        ]);

        return response()->json($asset, 201);
    }

    public function mediaAssetsIndex(Request $request): JsonResponse
    {
        return response()->json(
            MediaAsset::when($request->query('type'), fn ($query, $type) => $query->where('resource_type', $type))
                ->latest()
                ->get()
        );
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'company_ruc' => ['nullable', 'string', 'max:20'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'project_role' => ['nullable', 'string', 'max:255'],
            'hero_title' => ['nullable', 'string', 'max:255'],
            'hero_subtitle' => ['nullable', 'string', 'max:255'],
            'hero_images' => ['nullable', 'array', 'max:3'],
            'hero_images.*' => ['nullable', 'string', 'max:2048'],
            'about_text' => ['nullable', 'string'],
            'about_video_url' => ['nullable', 'string', 'max:2048'],
            'contact_phone' => ['nullable', 'string', 'max:120'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_address' => ['nullable', 'string', 'max:255'],
            'contact_whatsapp' => ['nullable', 'string', 'max:60'],
            'social_embeds' => ['nullable', 'array'],
            'social_embeds.*.platform' => ['required_with:social_embeds', 'string', 'max:40'],
            'social_embeds.*.url' => ['nullable', 'string', 'max:2048'],
            'community_platform' => ['nullable', 'string', 'max:60'],
            'community_join_method' => ['nullable', 'string', 'max:120'],
            'community_qr_url' => ['nullable', 'string', 'max:2048'],
            'bank_bcp_account' => ['nullable', 'string', 'max:60'],
            'bank_cci_account' => ['nullable', 'string', 'max:60'],
            'yape_number' => ['nullable', 'string', 'max:60'],
            'yape_holder_name' => ['nullable', 'string', 'max:120'],
            'manager_name' => ['nullable', 'string', 'max:120'],
            'manager_title' => ['nullable', 'string', 'max:120'],
        ]);

        if (array_key_exists('hero_images', $data)) {
            $data['hero_images'] = array_values(array_unique(array_filter($data['hero_images'] ?? [])));
        }

        $settings = SiteSetting::current();
        $settings->update($data);

        return response()->json($settings->fresh());
    }

    public function servicesIndex(): JsonResponse
    {
        return response()->json(SiteService::orderBy('sort_order')->get());
    }

    public function servicesShow(string $slug): JsonResponse
    {
        $service = SiteService::where('slug', $slug)->where('is_active', true)->firstOrFail();

        return response()->json($service);
    }

    public function servicesStore(Request $request): JsonResponse
    {
        $data = $this->validateService($request);
        $data['slug'] = $this->uniqueServiceSlug($data['slug'] ?? null, $data['title']);

        return response()->json(SiteService::create($data), 201);
    }

    public function servicesUpdate(SiteService $siteService, Request $request): JsonResponse
    {
        $data = $this->validateService($request, $siteService->id);
        $data['slug'] = $this->uniqueServiceSlug($data['slug'] ?? null, $data['title'], $siteService->id);
        $siteService->update($data);

        return response()->json($siteService->fresh());
    }

    public function servicesDestroy(SiteService $siteService): JsonResponse
    {
        $siteService->delete();

        return response()->json(status: 204);
    }

    public function testimonialsIndex(): JsonResponse
    {
        return response()->json(SiteTestimonial::orderBy('sort_order')->get());
    }

    public function testimonialsStore(Request $request): JsonResponse
    {
        return response()->json(SiteTestimonial::create($request->validate([
            'client_name' => ['required', 'string', 'max:255'],
            'quote' => ['required', 'string'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ])), 201);
    }

    public function testimonialsUpdate(SiteTestimonial $siteTestimonial, Request $request): JsonResponse
    {
        $siteTestimonial->update($request->validate([
            'client_name' => ['required', 'string', 'max:255'],
            'quote' => ['required', 'string'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return response()->json($siteTestimonial->fresh());
    }

    public function testimonialsDestroy(SiteTestimonial $siteTestimonial): JsonResponse
    {
        $siteTestimonial->delete();

        return response()->json(status: 204);
    }

    public function partnersIndex(): JsonResponse
    {
        return response()->json(SitePartner::orderBy('sort_order')->get());
    }

    public function partnersStore(Request $request): JsonResponse
    {
        return response()->json(SitePartner::create($this->validatePartner($request)), 201);
    }

    public function partnersUpdate(SitePartner $sitePartner, Request $request): JsonResponse
    {
        $sitePartner->update($this->validatePartner($request));

        return response()->json($sitePartner->fresh());
    }

    public function partnersDestroy(SitePartner $sitePartner): JsonResponse
    {
        $sitePartner->delete();

        return response()->json(status: 204);
    }

    private function validatePartner(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'logo_url' => ['required', 'string', 'max:2048'],
            'website_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    public function galleryIndex(): JsonResponse
    {
        return response()->json(SiteGalleryItem::orderBy('sort_order')->get());
    }

    public function galleryStore(Request $request): JsonResponse
    {
        return response()->json(SiteGalleryItem::create($request->validate([
            'image_url' => ['required', 'string', 'max:2048'],
            'caption' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ])), 201);
    }

    public function galleryUpdate(SiteGalleryItem $siteGalleryItem, Request $request): JsonResponse
    {
        $siteGalleryItem->update($request->validate([
            'image_url' => ['required', 'string', 'max:2048'],
            'caption' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return response()->json($siteGalleryItem->fresh());
    }

    public function galleryDestroy(SiteGalleryItem $siteGalleryItem): JsonResponse
    {
        $siteGalleryItem->delete();

        return response()->json(status: 204);
    }

    public function videosIndex(): JsonResponse
    {
        return response()->json(SiteVideo::orderBy('sort_order')->get());
    }

    public function videosStore(Request $request): JsonResponse
    {
        return response()->json(SiteVideo::create($request->validate([
            'video_url' => ['required', 'string', 'max:2048'],
            'caption' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ])), 201);
    }

    public function videosUpdate(SiteVideo $siteVideo, Request $request): JsonResponse
    {
        $siteVideo->update($request->validate([
            'video_url' => ['required', 'string', 'max:2048'],
            'caption' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]));

        return response()->json($siteVideo->fresh());
    }

    public function videosDestroy(SiteVideo $siteVideo): JsonResponse
    {
        $siteVideo->delete();

        return response()->json(status: 204);
    }

    public function catalogIndex(): JsonResponse
    {
        return response()->json(SiteCatalogItem::orderBy('category')->orderBy('sort_order')->get());
    }

    public function catalogStore(Request $request): JsonResponse
    {
        return response()->json(SiteCatalogItem::create($this->validateCatalogItem($request)), 201);
    }

    public function catalogUpdate(SiteCatalogItem $siteCatalogItem, Request $request): JsonResponse
    {
        $siteCatalogItem->update($this->validateCatalogItem($request));

        return response()->json($siteCatalogItem->fresh());
    }

    public function catalogDestroy(SiteCatalogItem $siteCatalogItem): JsonResponse
    {
        $siteCatalogItem->delete();

        return response()->json(status: 204);
    }

    private function validateCatalogItem(Request $request): array
    {
        return $request->validate([
            'category' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'unit_label' => ['nullable', 'string', 'max:60'],
            'price' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'measurement_hint' => ['nullable', 'string', 'max:1000'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function validateListItem(Request $request, array $rules): array
    {
        return $request->validate([
            ...$rules,
            'description' => ['nullable', 'string'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function validateService(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable',
                'string',
                'max:255',
                'alpha_dash',
                Rule::unique('site_services', 'slug')->ignore($ignoreId),
            ],
            'description' => ['nullable', 'string'],
            'icon_url' => ['nullable', 'string', 'max:2048'],
            'video_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function uniqueServiceSlug(?string $desired, string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($desired ?: $title) ?: 'servicio';
        $slug = $base;
        $suffix = 2;

        while (
            SiteService::where('slug', $slug)->when($ignoreId, fn ($query, $id) => $query->where('id', '!=', $id))->exists()
        ) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
