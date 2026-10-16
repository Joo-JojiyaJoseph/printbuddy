<?php

namespace App\Services\Printing;

/** Development stand-in: drops the PDF and its print options into a folder. No printer is involved. */
final class FilePrinter implements PrinterDriver
{
    public function __construct(private readonly string $directory) {}

    public function name(): string
    {
        return 'file';
    }

    public function available(): bool
    {
        return true;
    }

    public function send(string $pdfPath, array $job): ?string
    {
        if (! is_dir($this->directory) && ! @mkdir($this->directory, 0770, true) && ! is_dir($this->directory)) {
            throw new PrintException('The print folder could not be created.', retryable: true);
        }
        $base = preg_replace('/[^A-Za-z0-9\-]/', '', (string) ($job['reference'] ?? 'job')).'-'.date('His');
        if (! @copy($pdfPath, $this->directory.DIRECTORY_SEPARATOR.$base.'.pdf')) {
            throw new PrintException('The print file could not be saved.', retryable: true);
        }
        @file_put_contents($this->directory.DIRECTORY_SEPARATOR.$base.'.json', json_encode(array_diff_key($job, ['title' => 1]), JSON_PRETTY_PRINT));

        return $base.'.pdf';
    }
}
