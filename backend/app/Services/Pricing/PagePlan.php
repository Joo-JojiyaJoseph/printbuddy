<?php

namespace App\Services\Pricing;

use InvalidArgumentException;

/**
 * Validates the customer's page edits and turns them into an authoritative page count.
 *
 * Two shapes, chosen by document kind (the client cannot pick):
 *  - documents (PDF / Word / TXT):  edits.pages = ordered list of output pages
 *      [{src: 1-based source page | null (blank), rot: 0|90|180|270, align: fit|center|tl|fill, marks?: [...]}]
 *      marks are drawings ON TOP of the original page (text, white-out cover, highlight) in fractions of the displayed
 *      page; edits.stamp = {numbers: bool, watermark: string} is applied to every output page.
 *  - images (JPG / PNG):            edits.sheet = {per_page, mode, fit, margin, images:[{document_id, rot}]}
 *      mode 'sequence' packs images in order, `per_page` to a sheet;
 *      mode 'copies' repeats each image `per_page` times on its own sheet.
 *
 * Billable pages are always derived here; page_range then selects among these output pages.
 * No framework dependencies so it can be unit-tested without Laravel.
 */
final class PagePlan
{
    public const ROTATIONS = [0, 90, 180, 270];
    public const ALIGNS = ['fit', 'center', 'tl', 'fill'];
    public const PER_PAGE = [1, 2, 4, 6];
    /** Pages (slides) of a document printed on one sheet: a print setting for documents, billed per printed sheet side. */
    public const PAGES_PER_SHEET = [1, 2, 4, 6, 9];
    public const MODES = ['sequence', 'copies'];
    public const FITS = ['fit', 'fill'];
    public const MAX_IMAGES = 50;
    public const MAX_MARGIN_MM = 20;
    public const MARK_TYPES = ['text', 'cover', 'hl'];
    public const MAX_MARKS = 60;
    public const MAX_MARK_TEXT = 400;
    public const MAX_WATERMARK = 40;

    /**
     * @param  array<string>  $imageIds  ids of ready images in the customer's session
     * @return array{pages?:array,sheet?:array}|null normalised, whitelisted edits (null = none)
     *
     * @throws InvalidArgumentException with a customer-safe message
     */
    public static function normalize(?array $edits, int $sourcePages, string $kind, array $imageIds, string $primaryId, int $maxPages): ?array
    {
        if ($edits === null || $edits === [] || (($edits['pages'] ?? null) === null && ($edits['sheet'] ?? null) === null)) {
            return null;
        }
        $isImage = in_array($kind, ['jpg', 'png'], true);

        if ($isImage) {
            if (! empty($edits['pages'])) {
                throw new InvalidArgumentException('Page edits do not apply to images.');
            }

            return ['sheet' => self::sheet((array) $edits['sheet'], $imageIds, $primaryId, $maxPages)];
        }
        if (! empty($edits['sheet'])) {
            throw new InvalidArgumentException('Image layouts only apply to images.');
        }

        $out = ['pages' => self::pages((array) $edits['pages'], $sourcePages, $maxPages)];
        $stamp = self::stamp($edits['stamp'] ?? null);
        if ($stamp !== null) {
            $out['stamp'] = $stamp;
        }

        return $out;
    }

    /** Number of output pages the plan produces (what the customer is billed per copy before page_range). */
    public static function pageCount(array $normalized, int $sourcePages): int
    {
        if (isset($normalized['pages'])) {
            return count($normalized['pages']);
        }
        if (isset($normalized['sheet'])) {
            $n = count($normalized['sheet']['images']);

            return $normalized['sheet']['mode'] === 'copies' ? $n : (int) ceil($n / $normalized['sheet']['per_page']);
        }

        return $sourcePages;
    }

    private static function pages(array $pages, int $sourcePages, int $maxPages): array
    {
        $pages = array_values($pages);
        if ($pages === []) {
            throw new InvalidArgumentException('Keep at least one page to print.');
        }
        if (count($pages) > $maxPages) {
            throw new InvalidArgumentException("A print job is limited to {$maxPages} pages.");
        }
        $out = [];
        $hasContent = false;
        foreach ($pages as $p) {
            if (! is_array($p)) {
                throw new InvalidArgumentException('Your page edits could not be read.');
            }
            $src = $p['src'] ?? null;
            if ($src !== null && (! is_int($src) || $src < 1 || $src > $sourcePages)) {
                throw new InvalidArgumentException('One of the edited pages does not exist in the document.');
            }
            $rot = $p['rot'] ?? 0;
            if (! in_array($rot, self::ROTATIONS, true)) {
                throw new InvalidArgumentException('Unsupported page rotation.');
            }
            $align = $p['align'] ?? 'fit';
            if (! in_array($align, self::ALIGNS, true)) {
                throw new InvalidArgumentException('Unsupported page position.');
            }
            $hasContent = $hasContent || $src !== null;
            $item = ['src' => $src, 'rot' => $rot, 'align' => $align];
            $marks = self::marks($p['marks'] ?? []);
            if ($marks !== []) {
                $item['marks'] = $marks;
            }
            $out[] = $item;
        }
        if (! $hasContent) {
            throw new InvalidArgumentException('Keep at least one page with content.');
        }

        return $out;
    }

    /** Page numbers and/or a faint watermark on every page. Null when neither is asked for. */
    private static function stamp(mixed $stamp): ?array
    {
        if (! is_array($stamp)) {
            return null;
        }
        $numbers = ($stamp['numbers'] ?? false) === true;
        $wm = $stamp['watermark'] ?? '';
        if (! is_string($wm)) {
            throw new InvalidArgumentException('The watermark text could not be read.');
        }
        $wm = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $wm) ?? '');
        if (mb_strlen($wm) > self::MAX_WATERMARK) {
            throw new InvalidArgumentException('The watermark can be at most '.self::MAX_WATERMARK.' characters.');
        }

        return ($numbers || $wm !== '') ? ['numbers' => $numbers, 'watermark' => $wm] : null;
    }

    /**
     * Drawings on top of a page. Positions/sizes are fractions (0-1) of the displayed page; text size `fs` is a fraction of
     * the page height. Everything is whitelisted: unknown keys are dropped, numbers clamped, colours must be #rrggbb.
     *
     * @return list<array<string,mixed>>
     */
    private static function marks(mixed $marks): array
    {
        if ($marks === null || $marks === [] || $marks === '') {
            return [];
        }
        if (! is_array($marks) || count($marks) > self::MAX_MARKS) {
            throw new InvalidArgumentException('A page can have at most '.self::MAX_MARKS.' text boxes and highlights.');
        }
        $num = function (mixed $v, float $min, float $max): float {
            if (! is_int($v) && ! is_float($v)) {
                throw new InvalidArgumentException('One of your page marks could not be read.');
            }

            return round(max($min, min($max, (float) $v)), 4);
        };
        $color = function (mixed $v, string $default): string {
            if ($v === null) {
                return $default;
            }
            if (! is_string($v) || ! preg_match('/^#[0-9a-fA-F]{6}$/', $v)) {
                throw new InvalidArgumentException('Unsupported colour.');
            }

            return strtolower($v);
        };
        $out = [];
        foreach (array_values($marks) as $m) {
            if (! is_array($m) || ! in_array($m['t'] ?? null, self::MARK_TYPES, true)) {
                throw new InvalidArgumentException('One of your page marks could not be read.');
            }
            $x = $num($m['x'] ?? null, 0, 1);
            $y = $num($m['y'] ?? null, 0, 1);
            $w = $num($m['w'] ?? null, 0.005, 1 - $x);
            $h = $num($m['h'] ?? null, 0.005, 1 - $y);
            $item = ['t' => $m['t'], 'x' => $x, 'y' => $y, 'w' => $w, 'h' => $h];
            if ($m['t'] === 'text') {
                $text = $m['text'] ?? '';
                if (! is_string($text)) {
                    throw new InvalidArgumentException('One of your text boxes could not be read.');
                }
                $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', '', $text) ?? '';
                if (mb_strlen($text) > self::MAX_MARK_TEXT) {
                    throw new InvalidArgumentException('A text box can hold at most '.self::MAX_MARK_TEXT.' characters.');
                }
                $align = $m['align'] ?? 'l';
                if (! in_array($align, ['l', 'c', 'r'], true)) {
                    throw new InvalidArgumentException('Unsupported text alignment.');
                }
                $item += ['text' => $text, 'fs' => $num($m['fs'] ?? 0.02, 0.006, 0.15), 'color' => $color($m['color'] ?? null, '#000000'),
                    'bold' => ($m['bold'] ?? false) === true, 'align' => $align, 'cover' => ($m['cover'] ?? false) === true];
            } elseif ($m['t'] === 'cover') {
                $item['color'] = $color($m['color'] ?? null, '#ffffff');
            } else {
                $item['color'] = $color($m['color'] ?? null, '#ffe600');
            }
            $out[] = $item;
        }

        return $out;
    }

    private static function sheet(array $sheet, array $imageIds, string $primaryId, int $maxPages): array
    {
        $perPage = $sheet['per_page'] ?? 1;
        if (! in_array($perPage, self::PER_PAGE, true)) {
            throw new InvalidArgumentException('Choose 1, 2, 4 or 6 images per page.');
        }
        $mode = $sheet['mode'] ?? 'sequence';
        $fit = $sheet['fit'] ?? 'fit';
        if (! in_array($mode, self::MODES, true) || ! in_array($fit, self::FITS, true)) {
            throw new InvalidArgumentException('Unsupported image layout.');
        }
        $margin = $sheet['margin'] ?? 5;
        if (! is_int($margin) || $margin < 0 || $margin > self::MAX_MARGIN_MM) {
            throw new InvalidArgumentException('Margin must be between 0 and '.self::MAX_MARGIN_MM.' mm.');
        }
        $images = array_values((array) ($sheet['images'] ?? []));
        if ($images === [] || count($images) > self::MAX_IMAGES) {
            throw new InvalidArgumentException('Choose between 1 and '.self::MAX_IMAGES.' images.');
        }
        $out = [];
        $hasPrimary = false;
        foreach ($images as $img) {
            $id = is_array($img) ? ($img['document_id'] ?? null) : null;
            if (! is_string($id) || ! in_array($id, $imageIds, true)) {
                throw new InvalidArgumentException('One of the selected images is not available.');
            }
            $rot = $img['rot'] ?? 0;
            if (! in_array($rot, self::ROTATIONS, true)) {
                throw new InvalidArgumentException('Unsupported image rotation.');
            }
            $hasPrimary = $hasPrimary || $id === $primaryId;
            $out[] = ['document_id' => $id, 'rot' => $rot];
        }
        if (! $hasPrimary) {
            throw new InvalidArgumentException('The image you are editing must be part of the layout.');
        }
        $normalized = ['per_page' => $perPage, 'mode' => $mode, 'fit' => $fit, 'margin' => $margin, 'images' => $out];
        $sheets = self::pageCount(['sheet' => $normalized], 0);
        if ($sheets > $maxPages) {
            throw new InvalidArgumentException("A print job is limited to {$maxPages} pages.");
        }

        return $normalized;
    }
}
