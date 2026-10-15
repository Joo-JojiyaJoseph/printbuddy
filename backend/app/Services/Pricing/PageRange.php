<?php

namespace App\Services\Pricing;

use InvalidArgumentException;

/** Parses "1-3,5" style selections against a known page count. Empty = all pages. */
final class PageRange
{
    /** @return int[] sorted, unique, 1-based page numbers */
    public static function parse(string $spec, int $pageCount): array
    {
        if ($pageCount < 1) {
            throw new InvalidArgumentException('Document has no pages.');
        }
        $spec = trim($spec);
        if ($spec === '') {
            return range(1, $pageCount);
        }
        $pages = [];
        foreach (explode(',', $spec) as $part) {
            $part = trim($part);
            if (!preg_match('/^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/', $part, $m)) {
                throw new InvalidArgumentException("Invalid page range segment: {$part}");
            }
            $from = (int) $m[1];
            $to = isset($m[2]) ? (int) $m[2] : $from;
            if ($from < 1 || $to < $from || $to > $pageCount) {
                throw new InvalidArgumentException("Page range {$part} is outside 1-{$pageCount}.");
            }
            for ($p = $from; $p <= $to; $p++) {
                $pages[$p] = $p;
            }
        }
        ksort($pages);
        return array_values($pages);
    }
}
