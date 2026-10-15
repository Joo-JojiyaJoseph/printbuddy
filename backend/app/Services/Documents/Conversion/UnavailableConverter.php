<?php

namespace App\Services\Documents\Conversion;

/** Used when CONVERSION_DRIVER=none: Office uploads are accepted but reported as unconvertible. */
class UnavailableConverter implements DocumentConverter
{
    public function available(): bool
    {
        return false;
    }

    public function toPdf(string $sourcePath, string $targetPath): void
    {
        throw new ConversionException('Office document conversion is not enabled on this server. Please upload a PDF.', retryable: false);
    }
}
