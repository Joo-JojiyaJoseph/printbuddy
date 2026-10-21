<?php

namespace App\Services\Printing;

/**
 * Brightness, contrast and "enhance" for a customer's picture, done with PHP's GD library just before the sheet is made.
 *
 * Enhance is honest: it enlarges a picture that has too few pixels for the size it is printed at (smooth bicubic resampling)
 * and sharpens it gently. It cannot invent detail that was never in the photo. Anything that goes wrong (no GD, too big,
 * unreadable) returns null and the original picture is printed unchanged.
 */
final class ImageEnhancer
{
    public const MAX_SOURCE_PIXELS = 24_000_000; // the decoded picture needs about 4 bytes per pixel
    public const MAX_OUTPUT_PIXELS = 30_000_000;
    public const MAX_UPSCALE = 3.0;
    public const TARGET_DPI = 250;

    public static function available(): bool
    {
        return extension_loaded('gd') && function_exists('imagefilter') && function_exists('imagescale');
    }

    /** Factor to enlarge by so a picture shown `mmLong` mm wide reaches TARGET_DPI; 1.0 when it is already sharp enough. */
    public static function upscaleFactor(int $pxLong, float $mmLong): float
    {
        if ($pxLong < 1 || $mmLong <= 0) {
            return 1.0;
        }
        $needed = $mmLong / 25.4 * self::TARGET_DPI;

        return max(1.0, min(self::MAX_UPSCALE, $needed / $pxLong));
    }

    /**
     * @param  array{brightness?:int,contrast?:int,enhance?:bool}  $adjust
     * @param  int  $exifRotation  clockwise degrees to turn a camera photo upright (baked in, as the result has no EXIF)
     * @return array{path:string,type:string,w:int,h:int}|null  a temporary file the caller deletes
     */
    public static function process(string $path, string $type, int $exifRotation, array $adjust, float $mmLong, string $tmpDir): ?array
    {
        if (! self::available()) {
            return null;
        }
        $size = @getimagesize($path);
        if ($size === false || $size[0] * $size[1] > self::MAX_SOURCE_PIXELS) {
            return null;
        }
        $img = $type === 'PNG' ? @imagecreatefrompng($path) : @imagecreatefromjpeg($path);
        if ($img === false) {
            return null;
        }
        try {
            if ($exifRotation % 360 !== 0) {
                $turned = imagerotate($img, -($exifRotation % 360), 0); // GD turns counter-clockwise
                if ($turned !== false) {
                    $img = $turned;
                }
            }
            if ($type === 'PNG') {
                imagealphablending($img, false);
                imagesavealpha($img, true);
            }
            $b = (int) ($adjust['brightness'] ?? 0);
            $c = (int) ($adjust['contrast'] ?? 0);
            if ($b !== 0) {
                imagefilter($img, IMG_FILTER_BRIGHTNESS, (int) round($b * 2.55 * 0.8));
            }
            if ($c !== 0) {
                imagefilter($img, IMG_FILTER_CONTRAST, -(int) round($c * 0.8)); // GD's scale runs the other way: negative = more contrast
            }
            if (($adjust['enhance'] ?? false) === true) {
                $w = imagesx($img);
                $h = imagesy($img);
                $f = self::upscaleFactor(max($w, $h), $mmLong);
                if ($f > 1.01 && $w * $h * $f * $f <= self::MAX_OUTPUT_PIXELS) {
                    $big = imagescale($img, (int) round($w * $f), -1, IMG_BICUBIC);
                    if ($big !== false) {
                        $img = $big;
                    }
                }
                imageconvolution($img, [[-1, -1, -1], [-1, 16, -1], [-1, -1, -1]], 8, 0); // gentle sharpen
            }
            $out = tempnam($tmpDir, 'tpi');
            $ok = $type === 'PNG' ? imagepng($img, $out, 6) : imagejpeg($img, $out, 92);
            if (! $ok) {
                @unlink($out);

                return null;
            }

            return ['path' => $out, 'type' => $type, 'w' => imagesx($img), 'h' => imagesy($img)];
        } finally {
            unset($img);
        }
    }
}
