<?php

namespace Tests\Feature;

use App\Models\SiteSetting;
use App\Services\WatermarkService;
use Cloudinary\Cloudinary;

class WatermarkTest extends TallerTestCase
{
    private function url(array $steps): string
    {
        $image = (new Cloudinary(['cloud' => ['cloud_name' => 'demo', 'api_key' => 'k', 'api_secret' => 's']]))->image('base.jpg');

        foreach ($steps as $step) {
            $image->addTransformation($step);
        }

        return (string) $image->toUrl();
    }

    public function test_logo_is_applied_as_a_layer_in_the_top_right_and_company_name_in_the_bottom_right(): void
    {
        SiteSetting::current()->update(['company_name' => 'Calle Auto Center']);
        config(['taller.watermark.logo_public_id' => 'calleautocenter/logo', 'taller.watermark.text' => null]);

        $url = $this->url(app(WatermarkService::class)->transformation());

        $this->assertStringContainsString('c_limit,h_1600,w_1600', $url);
        $this->assertStringContainsString('l_calleautocenter:logo/', $url);
        $this->assertStringContainsString('fl_layer_apply,g_north_east', $url);
        $this->assertStringContainsString('l_text:Arial_44_bold:Calle%20Auto%20Center', $url);
        $this->assertStringContainsString('g_south_east', $url);
    }

    public function test_without_logo_only_the_text_is_stamped_and_without_company_name_nothing_is(): void
    {
        SiteSetting::current()->update(['company_name' => null]);
        config(['taller.watermark.logo_public_id' => null, 'taller.watermark.text' => null]);

        $this->assertCount(1, app(WatermarkService::class)->transformation());

        config(['taller.watermark.text' => 'Mi Taller']);
        $this->assertCount(2, app(WatermarkService::class)->transformation());
    }
}
