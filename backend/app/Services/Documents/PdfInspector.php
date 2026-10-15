<?php

namespace App\Services\Documents;

use RuntimeException;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;

/** Reads page counts from PDFs without rendering them. */
class PdfInspector
{
    /** Above this size we avoid the full in-memory parse and fall back to a streaming scan. */
    private const FULL_PARSE_LIMIT = 30 * 1024 * 1024;

    /** @throws RuntimeException with a customer-safe message */
    public function pageCount(string $path): int
    {
        $size = filesize($path);
        if ($size === false || $size === 0) {
            throw new RuntimeException('This PDF is empty.');
        }
        if ($size <= self::FULL_PARSE_LIMIT) {
            try {
                $config = new Config;
                $config->setRetainImageContent(false);
                $config->setIgnoreEncryption(false);
                $pdf = (new Parser([], $config))->parseFile($path);
                $count = count($pdf->getPages());
                if ($count > 0) {
                    return $count;
                }
            } catch (\Throwable $e) {
                if (stripos($e->getMessage(), 'secured') !== false || stripos($e->getMessage(), 'encrypt') !== false) {
                    throw new RuntimeException('This PDF is password-protected. Remove the password and upload it again.');
                }
                // fall through to the lightweight scan
            }
        }
        $count = $this->scanCount($path);
        if ($count < 1) {
            throw new RuntimeException('This PDF could not be read. It may be damaged.');
        }

        return $count;
    }

    /** Streaming fallback: the root /Pages node carries the largest /Count. */
    private function scanCount(string $path): int
    {
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            return 0;
        }
        $max = 0;
        $carry = '';
        while (! feof($fh)) {
            $chunk = $carry.fread($fh, 1 << 20);
            if (preg_match_all('/\/Type\s*\/Pages\b[^>]{0,400}?\/Count\s+(\d+)/s', $chunk, $m)) {
                foreach ($m[1] as $n) {
                    $max = max($max, (int) $n);
                }
            }
            if (preg_match_all('/\/Count\s+(\d+)[^>]{0,400}?\/Type\s*\/Pages\b/s', $chunk, $m2)) {
                foreach ($m2[1] as $n) {
                    $max = max($max, (int) $n);
                }
            }
            $carry = substr($chunk, -512);
        }
        fclose($fh);

        return $max;
    }
}
