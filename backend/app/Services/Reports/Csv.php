<?php

namespace App\Services\Reports;

/** CSV output for spreadsheets. Cells that start with = + - @ are prefixed so Excel never runs them as formulas. */
final class Csv
{
    public static function cell(mixed $v): string
    {
        $s = (string) ($v ?? '');
        $s = preg_replace('/[\r\n\t]+/', ' ', $s) ?? '';
        if ($s !== '' && strpbrk($s[0], "=+-@") !== false && ! is_numeric($s)) {
            $s = "'".$s;
        }

        return '"'.str_replace('"', '""', $s).'"';
    }

    public static function row(array $cells): string
    {
        return implode(',', array_map([self::class, 'cell'], $cells))."\r\n";
    }
}
