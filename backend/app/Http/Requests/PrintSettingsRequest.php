<?php

namespace App\Http\Requests;

use App\Services\Pricing\PagePlan;
use App\Support\Settings;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Shared by quote and order creation: `document_id` + `settings{...}`. Page range bounds are checked against the document later. */
class PrintSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->attributes->has('qr_session');
    }

    public function rules(): array
    {
        $settings = app(Settings::class);

        return [
            'document_id' => ['required', 'string', 'uuid'],
            'settings' => ['required', 'array'],
            'settings.page_range' => ['nullable', 'string', 'max:200', 'regex:/^[\d\s,\-]*$/'],
            'settings.copies' => ['required', 'integer', 'min:1', 'max:'.min(100, $settings->int('max_copies'))],
            'settings.color_mode' => ['required', Rule::in(['bw', 'color'])],
            'settings.paper_size' => ['required', 'string', Rule::in((array) $settings->get('paper_sizes'))],
            'settings.orientation' => ['required', Rule::in(['portrait', 'landscape'])],
            'settings.duplex' => ['required', 'boolean'],
            'settings.scaling' => ['required', Rule::in(['fit', 'fill', 'actual'])],
            'settings.pages_per_sheet' => ['nullable', 'integer', Rule::in(PagePlan::PAGES_PER_SHEET)],
            'settings.rotation' => ['nullable', 'integer', Rule::in([0, 90, 180, 270])],
            // Page edits / image layout. Shape is whitelisted here; PagePlan is the authority (bounds, ownership, pricing).
            'settings.edits' => ['nullable', 'array'],
            'settings.edits.pages' => ['nullable', 'array', 'max:'.min(500, $settings->int('max_pages'))],
            'settings.edits.pages.*' => ['array'],
            'settings.edits.pages.*.src' => ['nullable', 'integer', 'min:1'],
            'settings.edits.pages.*.rot' => ['nullable', 'integer', Rule::in(PagePlan::ROTATIONS)],
            'settings.edits.pages.*.align' => ['nullable', 'string', Rule::in(PagePlan::ALIGNS)],
            'settings.edits.pages.*.marks' => ['nullable', 'array', 'max:'.PagePlan::MAX_MARKS],
            'settings.edits.pages.*.marks.*' => ['array'],
            'settings.edits.pages.*.marks.*.t' => ['required', 'string', Rule::in(PagePlan::MARK_TYPES)],
            'settings.edits.pages.*.marks.*.x' => ['required', 'numeric'],
            'settings.edits.pages.*.marks.*.y' => ['required', 'numeric'],
            'settings.edits.pages.*.marks.*.w' => ['required', 'numeric'],
            'settings.edits.pages.*.marks.*.h' => ['required', 'numeric'],
            'settings.edits.pages.*.marks.*.text' => ['nullable', 'string', 'max:'.PagePlan::MAX_MARK_TEXT],
            'settings.edits.pages.*.marks.*.fs' => ['nullable', 'numeric'],
            'settings.edits.pages.*.marks.*.color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'settings.edits.pages.*.marks.*.bold' => ['nullable', 'boolean'],
            'settings.edits.pages.*.marks.*.cover' => ['nullable', 'boolean'],
            'settings.edits.pages.*.marks.*.align' => ['nullable', 'string', Rule::in(['l', 'c', 'r'])],
            'settings.edits.stamp' => ['nullable', 'array'],
            'settings.edits.stamp.numbers' => ['nullable', 'boolean'],
            'settings.edits.stamp.watermark' => ['nullable', 'string', 'max:'.PagePlan::MAX_WATERMARK],
            'settings.edits.sheet' => ['nullable', 'array'],
            'settings.edits.sheet.per_page' => ['nullable', 'integer', Rule::in(PagePlan::PER_PAGE)],
            'settings.edits.sheet.mode' => ['nullable', 'string', Rule::in(PagePlan::MODES)],
            'settings.edits.sheet.fit' => ['nullable', 'string', Rule::in(PagePlan::FITS)],
            'settings.edits.sheet.margin' => ['nullable', 'integer', 'min:0', 'max:'.PagePlan::MAX_MARGIN_MM],
            'settings.edits.sheet.images' => ['nullable', 'array', 'max:'.PagePlan::MAX_IMAGES],
            'settings.edits.sheet.images.*' => ['array'],
            'settings.edits.sheet.images.*.document_id' => ['required_with:settings.edits.sheet.images', 'string', 'uuid'],
            'settings.edits.sheet.images.*.rot' => ['nullable', 'integer', Rule::in(PagePlan::ROTATIONS)],
        ];
    }

    public function messages(): array
    {
        return [
            'settings.page_range.regex' => 'Page ranges may only contain numbers, commas and dashes (e.g. 1-3,5).',
            'settings.copies.max' => 'You can print at most :max copies.',
            'settings.pages_per_sheet.in' => 'Choose 1, 2, 4, 6 or 9 pages per sheet.',
            'settings.paper_size.in' => 'That paper size is not available.',
        ];
    }

    /** Normalised, whitelisted settings — the only shape ever stored on an order. */
    public function printSettings(): array
    {
        $s = $this->validated('settings');

        return [
            'page_range' => trim((string) ($s['page_range'] ?? '')),
            'copies' => (int) $s['copies'],
            'color_mode' => $s['color_mode'],
            'paper_size' => $s['paper_size'],
            'orientation' => $s['orientation'],
            'duplex' => (bool) $s['duplex'],
            'scaling' => $s['scaling'],
            'pages_per_sheet' => (int) ($s['pages_per_sheet'] ?? 1),
            'rotation' => (int) ($s['rotation'] ?? 0),
            'edits' => $s['edits'] ?? null,
        ];
    }
}
