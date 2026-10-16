<?php

namespace Database\Seeders;

use App\Models\Kiosk;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Local-development password used only when ADMIN_PASSWORD is empty and the app is not in production. */
    private const DEV_PASSWORD = 'Taprint@2026';

    public function run(): void
    {
        $this->admin();

        Kiosk::query()->firstOrCreate(['code' => 'demo'], ['name' => 'Demo Kiosk', 'active' => true]);
    }

    /** Creates the first admin once. Re-running the seeder never changes an existing account's password. */
    private function admin(): void
    {
        $c = config('printbuddy.admin');
        $password = (string) $c['password'];
        $usingDefault = false;

        if ($password === '') {
            if (app()->environment('production')) {
                $this->command?->warn('No admin created: set ADMIN_EMAIL and ADMIN_PASSWORD in .env (10+ characters), then run `php artisan db:seed` again.');

                return;
            }
            $password = self::DEV_PASSWORD;
            $usingDefault = true;
        }
        if (mb_strlen($password) < 10) {
            $this->command?->warn('No admin created: ADMIN_PASSWORD must be at least 10 characters.');

            return;
        }

        $user = User::query()->firstOrNew(['email' => (string) $c['email']]);
        if ($user->exists) {
            $this->command?->info("Admin {$user->email} already exists; left unchanged.");

            return;
        }
        $user->forceFill(['name' => (string) $c['name'], 'role' => User::ROLE_ADMIN, 'password' => $password])->save();
        $this->command?->info("Admin created: {$user->email}".($usingDefault ? " / {$password}  (development default - set ADMIN_PASSWORD in .env for anything real)" : ''));
    }
}
