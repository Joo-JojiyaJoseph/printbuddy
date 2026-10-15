<?php

namespace App\Http\Controllers\Api\V1\Admin\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Validated server-side pagination, sorting and date filtering shared by admin list endpoints. */
trait PaginatesAndFilters
{
    /** @param  array<string>  $sortable  column whitelist (never user-supplied raw) */
    protected function listParams(Request $request, array $sortable, array $extraRules = []): array
    {
        return $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort' => ['nullable', Rule::in($sortable)],
            'dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:120'],
        ] + $extraRules);
    }

    protected function applyCommon(Builder $query, array $p, string $defaultSort = 'created_at', string $dateColumn = 'created_at'): Builder
    {
        if (! empty($p['from'])) {
            $query->where($dateColumn, '>=', \Carbon\Carbon::parse($p['from'])->startOfDay());
        }
        if (! empty($p['to'])) {
            $query->where($dateColumn, '<=', \Carbon\Carbon::parse($p['to'])->endOfDay());
        }

        return $query->orderBy($p['sort'] ?? $defaultSort, $p['dir'] ?? 'desc');
    }

    protected function paginated(Builder $query, array $p, callable $map): array
    {
        $page = $query->paginate((int) ($p['per_page'] ?? 25));

        return [
            'data' => array_map($map, $page->items()),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ];
    }

    /** Escape LIKE wildcards so a search term is matched literally. */
    protected function like(string $term): string
    {
        return '%'.addcslashes($term, '%_\\').'%';
    }
}
