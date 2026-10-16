<?php

namespace App\Services\Documents\Conversion;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

/**
 * soffice --headless conversion in a throw-away profile directory with a hard timeout.
 * Macros never run in headless convert mode; the input is copied to an isolated work dir first so
 * the document can neither see nor touch the private storage tree. For stronger isolation run the
 * queue worker that executes this job in its own container/VM (see docs/deployment).
 */
class LibreOfficeConverter implements DocumentConverter
{
    public function __construct(
        private readonly string $binary,
        private readonly int $timeoutSeconds,
    ) {}

    public function available(): bool
    {
        return $this->resolveBinary() !== null;
    }

    public function toPdf(string $sourcePath, string $targetPath): void
    {
        $bin = $this->resolveBinary();
        if ($bin === null) {
            throw new ConversionException('Office document conversion is not available on this server.', retryable: true);
        }

        @set_time_limit($this->timeoutSeconds + 30);
        $work = storage_path('app/conversion/'.bin2hex(random_bytes(8)));
        File::ensureDirectoryExists($work.'/in');
        File::ensureDirectoryExists($work.'/out');
        File::ensureDirectoryExists($work.'/profile');
        $input = $work.'/in/source.'.strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION) ?: 'bin');
        copy($sourcePath, $input);

        try {
            $process = new Process([
                $bin, '--headless', '--norestore', '--nologo', '--nodefault', '--nolockcheck',
                '-env:UserInstallation=file:///'.str_replace('\\', '/', $work.'/profile'),
                '--convert-to', 'pdf', '--outdir', $work.'/out', $input,
            ]);
            $process->setTimeout($this->timeoutSeconds);
            $process->run();

            $produced = glob($work.'/out/*.pdf') ?: [];
            if (! $process->isSuccessful() || $produced === []) {
                Log::warning('LibreOffice conversion failed', ['exit' => $process->getExitCode(), 'stderr' => mb_substr($process->getErrorOutput(), 0, 500)]);
                throw new ConversionException('This document could not be converted to PDF.', retryable: false);
            }
            File::ensureDirectoryExists(dirname($targetPath));
            if (! rename($produced[0], $targetPath)) {
                throw new ConversionException('The converted file could not be stored.', retryable: true);
            }
        } catch (ProcessTimedOutException) {
            throw new ConversionException('Converting this document took too long. Try a smaller file.', retryable: false);
        } finally {
            File::deleteDirectory($work);
        }
    }

    private function resolveBinary(): ?string
    {
        if ($this->binary !== '' && is_file($this->binary)) {
            return $this->binary;
        }
        $found = (new ExecutableFinder)->find($this->binary ?: 'soffice');
        if ($found) {
            return $found;
        }
        foreach (['C:\\Program Files\\LibreOffice\\program\\soffice.exe', '/usr/bin/soffice', '/usr/lib/libreoffice/program/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
