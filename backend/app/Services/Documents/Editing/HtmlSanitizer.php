<?php

namespace App\Services\Documents\Editing;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;

/**
 * Whitelist sanitiser for customer-edited document HTML.
 *
 * The same HTML is (a) shown in the editor and (b) fed to LibreOffice to produce the print PDF, so it
 * must not carry scripts, event handlers, external resources (LibreOffice would fetch them: SSRF) or
 * layout-breaking CSS. Only a small set of tags, attributes and style properties survives; images are
 * kept only as small inline PNG/JPEG/GIF data URIs.
 */
final class HtmlSanitizer
{
    private const ALLOWED = [
        'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
        'span', 'div', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
        'blockquote', 'hr', 'img', 'pre', 'code',
    ];

    /** Removed together with everything inside them. */
    private const DROP = [
        'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'form', 'input',
        'button', 'select', 'textarea', 'svg', 'math', 'head', 'title', 'noscript', 'template', 'audio',
        'video', 'canvas', 'applet', 'base', 'source', 'track', 'map', 'area',
    ];

    private const COLOR = '/^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i';
    private const LENGTH = '/^-?\d{1,3}(\.\d{1,2})?(in|cm|mm|pt|px|em)?$/i';

    private const STYLES = [
        'text-align' => '/^(left|right|center|justify)$/i',
        'font-weight' => '/^(normal|bold|bolder|lighter|[1-9]00)$/i',
        'font-style' => '/^(normal|italic|oblique)$/i',
        'text-decoration' => '/^(none|underline|line-through|underline line-through)$/i',
        'font-size' => '/^(\d{1,3}(\.\d{1,2})?(pt|px|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large)$/i',
        'color' => self::COLOR,
        'background-color' => self::COLOR,
        'font-family' => '/^[A-Za-z0-9 ,\'"\-]{1,100}$/',
        'line-height' => '/^\d{1,3}(\.\d{1,2})?(%|pt|px|em)?$/i',
        'margin-top' => self::LENGTH,
        'margin-bottom' => self::LENGTH,
        'margin-left' => self::LENGTH,
        'text-indent' => self::LENGTH,
        'page-break-before' => '/^(always|auto|avoid)$/i',
        'page-break-after' => '/^(always|auto|avoid)$/i',
    ];

    private const MAX_IMAGE_URI = 2_500_000;

    public static function clean(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        $previous = libxml_use_internal_errors(true);
        $doc = new DOMDocument;
        $doc->loadHTML('<?xml encoding="utf-8" ?><body>'.$html, LIBXML_NONET | LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_COMPACT);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $body = $doc->getElementsByTagName('body')->item(0);
        if ($body === null) {
            return '';
        }
        self::walk($body);

        $out = '';
        foreach ($body->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }

        return trim($out);
    }

    private static function walk(DOMNode $parent): void
    {
        foreach (iterator_to_array($parent->childNodes) as $node) {
            if ($node instanceof DOMText) {
                continue;
            }
            if (! $node instanceof DOMElement) {
                $parent->removeChild($node); // comments, CDATA, processing instructions

                continue;
            }
            $name = strtolower($node->nodeName);
            if (in_array($name, self::DROP, true)) {
                $parent->removeChild($node);

                continue;
            }
            if (! in_array($name, self::ALLOWED, true)) {
                self::walk($node); // unknown/presentational tag (font, a, section...): keep its contents only
                while ($node->firstChild) {
                    $parent->insertBefore($node->firstChild, $node);
                }
                $parent->removeChild($node);

                continue;
            }
            if (! self::cleanAttributes($node, $name)) {
                $parent->removeChild($node);

                continue;
            }
            self::walk($node);
        }
    }

    /** @return bool false when the element itself must be dropped (e.g. an image without a safe source) */
    private static function cleanAttributes(DOMElement $el, string $name): bool
    {
        foreach (iterator_to_array($el->attributes) as $attr) {
            $attrName = strtolower($attr->nodeName);
            $value = trim($attr->nodeValue ?? '');
            $el->removeAttributeNode($attr);

            switch ($attrName) {
                case 'style':
                    $style = self::cleanStyle($value);
                    if ($style !== '') {
                        $el->setAttribute('style', $style);
                    }
                    break;
                case 'align':
                    if (preg_match('/^(left|right|center|justify)$/i', $value)) {
                        $el->setAttribute('align', strtolower($value));
                    }
                    break;
                case 'colspan':
                case 'rowspan':
                    if (in_array($name, ['td', 'th'], true) && ctype_digit($value) && (int) $value >= 1 && (int) $value <= 50) {
                        $el->setAttribute($attrName, $value);
                    }
                    break;
                case 'width':
                case 'height':
                    if (in_array($name, ['td', 'th', 'img', 'table'], true) && preg_match('/^\d{1,4}%?$/', $value)) {
                        $el->setAttribute($attrName, $value);
                    }
                    break;
                case 'src':
                    if ($name === 'img' && strlen($value) <= self::MAX_IMAGE_URI
                        && preg_match('#^data:image/(png|jpeg|gif);base64,[A-Za-z0-9+/=\s]+$#', $value)) {
                        $el->setAttribute('src', preg_replace('/\s+/', '', $value));
                    }
                    break;
                case 'alt':
                    if ($name === 'img') {
                        $el->setAttribute('alt', mb_substr($value, 0, 200));
                    }
                    break;
            }
        }

        return $name !== 'img' || $el->hasAttribute('src');
    }

    private static function cleanStyle(string $style): string
    {
        $kept = [];
        foreach (explode(';', $style) as $decl) {
            if (! str_contains($decl, ':')) {
                continue;
            }
            [$prop, $val] = array_map('trim', explode(':', $decl, 2));
            $prop = strtolower($prop);
            $val = trim(preg_replace('/\s*!important\s*$/i', '', $val));
            if (! isset(self::STYLES[$prop]) || $val === '' || ! preg_match(self::STYLES[$prop], $val)) {
                continue;
            }
            if (in_array($prop, ['font-size', 'line-height'], true) && (float) $val > 400) {
                continue;
            }
            $kept[] = $prop.': '.$val;
        }

        return implode('; ', $kept);
    }
}
