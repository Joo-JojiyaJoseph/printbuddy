<?php

namespace App\Services\Documents\Editing;

use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;

/**
 * Reads the text out of a PDF so it can be edited. PDFs carry positioned glyphs, not paragraphs, so this
 * is deliberately lossy: layout, fonts and pictures are not kept and scanned PDFs have no text at all.
 * Each source page becomes one block (lines joined with <br>) and a page-break style separates blocks.
 */
final class PdfTextExtractor
{
    public function __construct(
        private readonly int $maxBytes = 15 * 1024 * 1024,
        private readonly int $maxChars = 400_000,
    ) {}

    /** @throws EditingException */
    public function toHtml(string $path, int $maxPages): string
    {
        $size = filesize($path);
        if ($size === false || $size > $this->maxBytes) {
            throw new EditingException('This PDF is too large to edit as text. You can still print it as it is.');
        }
        try {
            $config = new Config;
            $config->setRetainImageContent(false);
            $pdf = (new Parser([], $config))->parseFile($path);
            $pages = $pdf->getPages();
        } catch (\Throwable) {
            throw new EditingException('We could not read the text in this PDF.');
        }

        $blocks = [];
        $chars = 0;
        foreach (array_slice($pages, 0, $maxPages) as $page) {
            try {
                $text = (string) $page->getText();
            } catch (\Throwable) {
                $text = '';
            }
            $text = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
            $lines = array_values(array_filter(array_map('trim', preg_split('/\R/u', $text) ?: []), fn ($l) => $l !== ''));
            $chars += mb_strlen($text);
            if ($chars > $this->maxChars) {
                throw new EditingException('This PDF has too much text to edit here. You can still print it as it is.');
            }
            $html = implode('<br>', array_map(fn ($l) => htmlspecialchars($l, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $lines));
            $blocks[] = $lines === [] ? null : $html;
        }
        if (count(array_filter($blocks)) === 0) {
            throw new EditingException("This PDF has no selectable text (it may be a scan), so its text can't be edited.");
        }

        $out = '';
        foreach ($blocks as $i => $html) {
            $style = $i > 0 ? ' style="page-break-before: always"' : '';
            $out .= "<p{$style}>".($html ?? '&nbsp;').'</p>';
        }

        return $out;
    }
}
