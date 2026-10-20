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
        throw new ConversionException('Word, Excel and PowerPoint are prepared in the customer browser, not on this server. Save the file as a PDF and upload that.', retryable: false);
    }
}
