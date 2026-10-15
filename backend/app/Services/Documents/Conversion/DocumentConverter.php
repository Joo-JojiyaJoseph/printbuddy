<?php

namespace App\Services\Documents\Conversion;

/** Converts Office documents (doc/docx/xls/xlsx/ppt/pptx) into PDF. Implementations must never execute macros. */
interface DocumentConverter
{
    /**
     * @param  string  $sourcePath  absolute path of the uploaded file (read-only)
     * @param  string  $targetPath  absolute path where the PDF must be written
     *
     * @throws ConversionException with a customer-safe message; set $retryable for transient failures
     */
    public function toPdf(string $sourcePath, string $targetPath): void;

    /** Whether conversions are possible at all on this deployment (binary present, service reachable...). */
    public function available(): bool;
}
