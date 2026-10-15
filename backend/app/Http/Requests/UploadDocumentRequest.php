<?php

namespace App\Http\Requests;

use App\Support\Settings;
use Illuminate\Foundation\Http\FormRequest;

class UploadDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->attributes->has('qr_session');
    }

    public function rules(): array
    {
        $maxKb = app(Settings::class)->int('max_upload_mb') * 1024;

        return [
            // Content (magic bytes + finfo) is checked by FileTypeDetector; this is only the cheap first gate.
            'file' => ['required', 'file', 'max:'.$maxKb],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Choose a file to upload.',
            'file.max' => 'Files must be '.app(Settings::class)->int('max_upload_mb').' MB or smaller.',
        ];
    }
}
