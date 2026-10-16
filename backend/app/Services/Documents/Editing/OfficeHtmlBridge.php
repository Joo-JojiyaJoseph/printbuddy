<?php

namespace App\Services\Documents\Editing;

/**
 * Word <-> HTML <-> PDF through headless LibreOffice, in a throw-away work directory and profile with a hard
 * timeout (same isolation approach as LibreOfficeConverter). Framework-free on purpose so it is unit-testable.
 */
final class OfficeHtmlBridge
{
    private const MAX_HTML_BYTES = 8_000_000;
    private const MAX_INLINE_IMAGE = 1_500_000;

    public function __construct(
        private readonly string $binary,
        private readonly int $timeoutSeconds,
        private readonly string $workRoot,
    ) {}

    public function available(): bool
    {
        return $this->resolveBinary() !== null;
    }

    /** Wrap a sanitised fragment into the full document LibreOffice prints. */
    public static function wrapDocument(string $fragment): string
    {
        return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title>'
            ."<style>body{font-family:'Liberation Serif','Times New Roman',serif;font-size:12pt;line-height:1.25}"
            .'table{border-collapse:collapse}td,th{border:1px solid #888;padding:2px 6px}</style></head><body>'
            .$fragment.'</body></html>';
    }

    /**
     * @throws EditingException
     */
    public function wordToHtml(string $sourcePath, string $extension): string
    {
        $extension = strtolower($extension);
        if (! in_array($extension, ['doc', 'docx'], true)) {
            throw new EditingException('Only Word documents can be edited as text.');
        }

        return $this->withWorkDir(function (string $work) use ($sourcePath, $extension) {
            $input = $work.'/in/source.'.$extension;
            if (! @copy($sourcePath, $input)) {
                throw new EditingException('The document is no longer available.');
            }
            $this->run($work, ['--convert-to', 'html', '--outdir', $work.'/out', $input]);
            $files = glob($work.'/out/*.html') ?: [];
            if ($files === [] || filesize($files[0]) > self::MAX_HTML_BYTES) {
                throw new EditingException('This document could not be opened for editing.');
            }
            $html = (string) file_get_contents($files[0]);

            return $this->inlineImages($html, $work.'/out');
        });
    }

    /**
     * @throws EditingException
     */
    public function htmlToPdf(string $sanitisedFragment, string $targetPath): void
    {
        $this->withWorkDir(function (string $work) use ($sanitisedFragment, $targetPath) {
            $input = $work.'/in/document.html';
            file_put_contents($input, self::wrapDocument($sanitisedFragment));
            $this->run($work, ['--convert-to', 'pdf:writer_web_pdf_Export', '--outdir', $work.'/out', $input]);
            $pdf = $work.'/out/document.pdf';
            if (! is_file($pdf) || filesize($pdf) === 0) {
                throw new EditingException('We could not turn your edits into a printable document.');
            }
            if (! is_dir(dirname($targetPath))) {
                @mkdir(dirname($targetPath), 0770, true);
            }
            if (! @rename($pdf, $targetPath) && ! (@copy($pdf, $targetPath) && @unlink($pdf))) {
                throw new EditingException('The edited document could not be stored.');
            }
        });
    }

    /** @template T @param callable(string):T $fn @return T */
    private function withWorkDir(callable $fn): mixed
    {
        if ($this->resolveBinary() === null) {
            throw new EditingException('Text editing is not available on this server.');
        }
        $work = rtrim($this->workRoot, '/\\').DIRECTORY_SEPARATOR.bin2hex(random_bytes(8));
        foreach (['in', 'out', 'profile'] as $d) {
            if (! @mkdir($work.DIRECTORY_SEPARATOR.$d, 0770, true) && ! is_dir($work.DIRECTORY_SEPARATOR.$d)) {
                throw new EditingException('Text editing is temporarily unavailable.');
            }
        }
        try {
            return $fn(str_replace('\\', '/', $work));
        } finally {
            $this->deleteDir($work);
        }
    }

    private function run(string $work, array $args): void
    {
        @set_time_limit($this->timeoutSeconds + 30); // the web server's 30 s PHP limit is shorter than a cold LibreOffice start
        $profile = '/'.ltrim($work.'/profile', '/');
        $cmd = array_merge([
            (string) $this->resolveBinary(), '--headless', '--norestore', '--nologo', '--nodefault', '--nolockcheck',
            '-env:UserInstallation=file://'.$profile,
        ], $args);
        $env = array_merge(getenv() ?: [], ['HOME' => $work]);
        $proc = @proc_open($cmd, [0 => ['pipe', 'r'], 1 => ['file', $work.'/stdout.txt', 'w'], 2 => ['file', $work.'/stderr.txt', 'w']], $pipes, $work, $env);
        if (! is_resource($proc)) {
            throw new EditingException('Text editing is temporarily unavailable.');
        }
        fclose($pipes[0]);
        $deadline = microtime(true) + $this->timeoutSeconds;
        while (true) {
            $status = proc_get_status($proc);
            if (! $status['running']) {
                break;
            }
            if (microtime(true) > $deadline) {
                proc_terminate($proc, 9);
                proc_close($proc);
                throw new EditingException('This document took too long to process. Try a smaller one.');
            }
            usleep(100_000);
        }
        proc_close($proc);
    }

    /** Inline images LibreOffice wrote next to the HTML (basename only, known image types, size-capped). */
    private function inlineImages(string $html, string $dir): string
    {
        return preg_replace_callback('/(<img\b[^>]*?\bsrc=")([^"\/\\\\:]+)(")/i', function (array $m) use ($dir) {
            $file = $dir.'/'.$m[2];
            if (! is_file($file) || filesize($file) > self::MAX_INLINE_IMAGE) {
                return $m[0];
            }
            $mime = function_exists('mime_content_type') ? @mime_content_type($file) : false;
            if (! in_array($mime, ['image/png', 'image/jpeg', 'image/gif'], true)) {
                return $m[0];
            }

            return $m[1].'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($file)).$m[3];
        }, $html) ?? $html;
    }

    private function deleteDir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $f) {
            $f->isDir() && ! $f->isLink() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        }
        @rmdir($dir);
    }

    private function resolveBinary(): ?string
    {
        if ($this->binary !== '' && is_file($this->binary)) {
            return $this->binary;
        }
        $name = $this->binary !== '' ? $this->binary : 'soffice';
        foreach (explode(PATH_SEPARATOR, (string) getenv('PATH')) as $dir) {
            foreach (['', '.exe', '.com'] as $ext) {
                $candidate = rtrim($dir, '/\\').DIRECTORY_SEPARATOR.$name.$ext;
                if ($dir !== '' && is_file($candidate) && is_executable($candidate)) {
                    return $candidate;
                }
            }
        }
        foreach (['C:\\Program Files\\LibreOffice\\program\\soffice.exe', '/usr/bin/soffice', '/usr/lib/libreoffice/program/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
