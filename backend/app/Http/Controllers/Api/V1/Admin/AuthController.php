<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    /** POST /admin/login — Sanctum personal access token. Rate limited (admin-login). */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:200'],
        ]);
        $user = User::query()->where('email', $data['email'])->first();
        if ($user === null || ! Hash::check($data['password'], $user->password) || ! in_array($user->role, User::ROLES, true)) {
            $this->audit->log('admin.login_failed', 'User', ['email' => $data['email']]);
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }
        $token = $user->createToken('admin', ['admin:'.$user->role], now()->addHours(12));
        $this->audit->log('admin.login', $user, [], $user->id);

        return response()->json(['data' => ['token' => $token->plainTextToken, 'user' => $this->userPayload($user)]]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->userPayload($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();
        $this->audit->log('admin.logout', $request->user());

        return response()->json(null, 204);
    }

    private function userPayload(User $u): array
    {
        return ['id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'role' => $u->role];
    }
}
