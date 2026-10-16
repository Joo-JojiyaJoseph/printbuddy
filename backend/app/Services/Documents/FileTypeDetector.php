<?php

namespace App\Services\Documents;

/**
 * Determines the real document kind from file CONTENT (magic bytes + finfo), then checks that the
 * claimed extension agrees. Filenames and browser MIME types are never trusted on their own.
 */
class FileTypeDetector
{
    public const EXT_KIND = [
        'pdf' => 'pdf', 'jpg' => 'jpg', 'jpeg' => 'jpg', 'jfif' => 'jpg', 'jpe' => 'jpg', 'png' => 'png', 'txt' => 'txt', // .jfif and .jpe are plain JPEG files
        'doc' => 'ole', 'xls' => 'ole', 'ppt' => 'ole', 'docx' => 'ooxml', 'xlsx' => 'ooxml', 'pptx' => 'ooxml',
    ];

    private const KIND_MIMES = [
        'pdf' => ['application/pdf'],
        'jpg' => ['image/jpeg'],
        'png' => ['image/png'],
        'txt' => ['text/plain'],
        'ole' => ['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'application/CDFV2', 'application/x-ole-storage', 'application/octet-stream'],
        'ooxml' => [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/zip', 'application/octet-stream',
        ],
    ];

    /** @return array{ok:true,kind:string,ext:string,mime:string}|array{ok:false,error:string,status:int} */
    public function inspect(string $path, string $originalName, array $allowedExtensions): array
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $head0 = (string) file_get_contents($path, false, null, 0, 4096);
        $real = $this->sniff($head0);
        // A JPEG/PNG with a missing or unfamiliar extension is accepted by its content; a known-but-wrong one (PNG named .jpg) is still refused.
        if (in_array($real, ['jpg', 'png'], true) && ! isset(self::EXT_KIND[$ext])) {
            $ext = $real;
        }
        if (str_starts_with($head0, 'RIFF') && substr($head0, 8, 4) === 'WEBP') {
            return ['ok' => false, 'error' => 'WebP images are not supported yet. Save the picture as JPG or PNG and upload it again.', 'status' => 415];
        }
        if (substr($head0, 4, 4) === 'ftyp' && in_array(substr($head0, 8, 4), ['heic', 'heix', 'mif1', 'heif'], true)) {
            return ['ok' => false, 'error' => 'HEIC photos are not supported yet. Share or save the photo as JPG and upload it again.', 'status' => 415];
        }
        if (! isset(self::EXT_KIND[$ext])) {
            return ['ok' => false, 'error' => 'This file type is not supported. Use PDF, JPG, PNG, Word, Excel, PowerPoint or text files.', 'status' => 415];
        }
        $normalizedExt = in_array($ext, ['jpeg', 'jfif', 'jpe'], true) ? 'jpg' : $ext;
        if (! in_array($normalizedExt, $allowedExtensions, true)) {
            return ['ok' => false, 'error' => strtoupper($normalizedExt).' uploads are currently disabled.', 'status' => 415];
        }

        $head = (string) file_get_contents($path, false, null, 0, 4096);
        $sniffed = $this->sniff($head);
        $expected = self::EXT_KIND[$ext];
        if ($sniffed !== $expected) {
            return ['ok' => false, 'error' => "This doesn't look like a valid .{$ext} file.", 'status' => 415];
        }

        $mime = $this->finfoMime($path);
        if ($mime !== null && ! in_array($mime, self::KIND_MIMES[$expected], true) && ! ($expected === 'txt' && str_starts_with($mime, 'text/'))) {
            return ['ok' => false, 'error' => "This doesn't look like a valid .{$ext} file.", 'status' => 415];
        }

        return ['ok' => true, 'kind' => $expected, 'ext' => $normalizedExt, 'mime' => $mime ?? self::KIND_MIMES[$expected][0]];
    }

    public function sniff(string $head): ?string
    {
        if (str_starts_with($head, "%PDF")) {
            return 'pdf';
        }
        if (str_starts_with($head, "\xFF\xD8\xFF")) {
            return 'jpg';
        }
        if (str_starts_with($head, "\x89PNG\r\n\x1A\n")) {
            return 'png';
        }
        if (str_starts_with($head, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1")) {
            return 'ole';
        }
        if (str_starts_with($head, "PK\x03\x04")) {
            return 'ooxml';
        }
        if ($head !== '' && ! str_contains($head, "\0") && mb_check_encoding($head, 'UTF-8')) {
            return 'txt';
        }

        return null;
    }

    private function finfoMime(string $path): ?string
    {
        if (! function_exists('finfo_open')) {
            return null;
        }
        $f = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $f ? finfo_file($f, $path) : false;
        if ($f) {
            finfo_close($f);
        }

        return is_string($mime) ? $mime : null;
    }
}
