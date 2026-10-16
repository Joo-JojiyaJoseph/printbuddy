<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create {email : Login e-mail} {--name=Admin : Display name} {--role=admin : admin, operator or viewer} {--password= : Leave empty to be asked (recommended)}';
    protected $description = 'Create (or reset the password of) an admin panel user';

    public function handle(): int
    {
        $role = (string) $this->option('role');
        $password = (string) ($this->option('password') ?: $this->secret('Password (min 10 characters)'));
        $v = Validator::make(
            ['email' => $this->argument('email'), 'role' => $role, 'password' => $password],
            ['email' => ['required', 'email', 'max:190'], 'role' => ['required', 'in:'.implode(',', User::ROLES)], 'password' => ['required', 'string', 'min:10', 'max:200']],
        );
        if ($v->fails()) {
            foreach ($v->errors()->all() as $e) {
                $this->error($e);
            }

            return self::FAILURE;
        }
        $user = User::query()->firstOrNew(['email' => $this->argument('email')]);
        $user->forceFill(['name' => (string) $this->option('name'), 'role' => $role, 'password' => $password])->save();
        $this->info("Saved {$user->email} as {$role}. Sign in at /admin/login.");

        return self::SUCCESS;
    }
}
