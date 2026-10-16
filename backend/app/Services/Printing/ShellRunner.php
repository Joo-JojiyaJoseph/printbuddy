<?php

namespace App\Services\Printing;

/** Runs an external program with a hard timeout, no shell, output captured to files. */
final class ShellRunner
{
    /** @return array{exit:int,out:string,err:string} */
    public static function run(array $cmd, int $timeoutSeconds, ?string $cwd = null): array
    {
        $base = sys_get_temp_dir().DIRECTORY_SEPARATOR.'pb-run-'.bin2hex(random_bytes(6));
        $proc = @proc_open($cmd, [0 => ['pipe', 'r'], 1 => ['file', $base.'.out', 'w'], 2 => ['file', $base.'.err', 'w']], $pipes, $cwd);
        if (! is_resource($proc)) {
            return ['exit' => 127, 'out' => '', 'err' => 'could not start program'];
        }
        fclose($pipes[0]);
        $deadline = microtime(true) + $timeoutSeconds;
        $exit = -1;
        while (true) {
            $st = proc_get_status($proc);
            if (! $st['running']) {
                $exit = $st['exitcode'];
                break;
            }
            if (microtime(true) > $deadline) {
                proc_terminate($proc, 9);
                $exit = 124;
                break;
            }
            usleep(50_000);
        }
        proc_close($proc);
        $out = is_file($base.'.out') ? (string) file_get_contents($base.'.out', false, null, 0, 20000) : '';
        $err = is_file($base.'.err') ? (string) file_get_contents($base.'.err', false, null, 0, 20000) : '';
        @unlink($base.'.out');
        @unlink($base.'.err');

        return ['exit' => $exit, 'out' => $out, 'err' => $err];
    }

    /** Locate an executable by configured path, PATH lookup (with Windows extensions) or well-known folders. */
    public static function find(string $configured, string $default, array $extra = []): ?string
    {
        if ($configured !== '' && is_file($configured)) {
            return $configured;
        }
        $name = $configured !== '' ? $configured : $default;
        foreach (explode(PATH_SEPARATOR, (string) getenv('PATH')) as $dir) {
            foreach (['', '.exe', '.com', '.bat'] as $ext) {
                $c = rtrim($dir, '/\\').DIRECTORY_SEPARATOR.$name.$ext;
                if ($dir !== '' && is_file($c) && is_executable($c)) {
                    return $c;
                }
            }
        }
        foreach ($extra as $c) {
            if (is_file($c)) {
                return $c;
            }
        }

        return null;
    }
}
