<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Staff accounts. Admin role only. */
class UserController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => User::query()->orderBy('name')->get()->map(fn (User $u) => $this->row($u))->all()]);
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'role' => ['required', Rule::in(User::ROLES)],
            'password' => ['required', 'string', 'min:10', 'max:200'],
        ]);
        $u = User::query()->forceCreate($d);
        $this->audit->log('user.created', $u, ['role' => $u->role]);

        return response()->json(['data' => $this->row($u)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $u = User::query()->findOrFail($id);
        $d = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'role' => ['sometimes', Rule::in(User::ROLES)],
            'password' => ['sometimes', 'nullable', 'string', 'min:10', 'max:200'],
        ]);
        if (isset($d['role']) && $d['role'] !== User::ROLE_ADMIN && $u->isAdmin() && User::query()->where('role', User::ROLE_ADMIN)->count() <= 1) {
            return response()->json(['message' => 'There must be at least one admin.'], 409);
        }
        if (empty($d['password'])) {
            unset($d['password']);
        }
        $u->forceFill($d)->save();
        if (isset($d['password']) || isset($d['role'])) {
            $u->tokens()->delete(); // a changed password or role signs that person out everywhere
        }
        $this->audit->log('user.updated', $u, ['fields' => array_keys($d)]);

        return response()->json(['data' => $this->row($u)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $u = User::query()->findOrFail($id);
        if ($u->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 409);
        }
        if ($u->isAdmin() && User::query()->where('role', User::ROLE_ADMIN)->count() <= 1) {
            return response()->json(['message' => 'There must be at least one admin.'], 409);
        }
        $this->audit->log('user.deleted', $u, ['email' => $u->email]);
        $u->tokens()->delete();
        $u->delete();

        return response()->json(null, 204);
    }

    private function row(User $u): array
    {
        return ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role, 'created_at' => $u->created_at?->toIso8601String()];
    }
}
