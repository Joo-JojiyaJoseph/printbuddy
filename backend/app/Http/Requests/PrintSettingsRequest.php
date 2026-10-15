<?php

namespace App\Http\Requests;

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
            'settings.rotation' => ['nullable', 'integer', Rule::in([0, 90, 180, 270])],
        ];
    }

    public function messages(): array
    {
        return [
            'settings.page_range.regex' => 'Page ranges may only contain numbers, commas and dashes (e.g. 1-3,5).',
            'settings.copies.max' => 'You can print at most :max copies.',
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
            'rotation' => (int) ($s['rotation'] ?? 0),
        ];
    }
}
