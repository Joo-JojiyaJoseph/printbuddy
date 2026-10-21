<?php

namespace App\Services\Printing;

use RuntimeException;

/**
 * The ready-to-run shop PC package: the print agent program plus a config.json that already holds this kiosk's address and
 * key, so setting up another shop PC is "unzip, double-click install-agent.bat".
 */
final class AgentBundle
{
    public const FILES = ['agent.mjs', 'lib.mjs', 'install-agent.bat', 'run-agent.bat', 'start-agent.bat', 'start-hidden.vbs', 'test-agent.bat', 'uninstall-agent.bat', 'README.md'];

    public function __construct(private readonly string $sourceDir) {}

    /** @return string path of a temporary .zip (the caller deletes it) */
    public function build(string $server, string $key, ?string $screenUrl = null): string
    {
        if (! class_exists(\ZipArchive::class)) {
            throw new RuntimeException('The zip extension is not available on this server.');
        }
        $config = json_encode(['server' => rtrim($server, '/'), 'key' => $key, 'sumatraPath' => '', 'popplerPath' => '', 'printerName' => '', 'pollSeconds' => 2], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $tmp = tempnam(sys_get_temp_dir(), 'tpa').'.zip';
        $zip = new \ZipArchive();
        if ($zip->open($tmp, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create the setup file.');
        }
        foreach (self::FILES as $f) {
            $path = $this->sourceDir.DIRECTORY_SEPARATOR.$f;
            if (! is_file($path)) {
                $zip->close();
                @unlink($tmp);
                throw new RuntimeException('The print program files are missing on the server.');
            }
            $zip->addFile($path, 'print-agent/'.$f);
        }
        $zip->addFromString('print-agent/config.json', str_replace("\n", "\r\n", (string) $config)."\r\n");
        if ($screenUrl !== null && preg_match('#^https?://[A-Za-z0-9.\-:/_]+$#', $screenUrl)) {
            // Full-screen customer screen with no address bar, so nobody can edit the web address.
            $bat = "@echo off\r\nrem Opens the customer screen full screen with no address bar. Press Alt+F4 to close it.\r\n"
                ."set URL={$screenUrl}\r\n"
                .'for %%P in ("%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe") do if exist %%P ('."\r\n"
                .'  start "" %%P --kiosk --no-first-run --user-data-dir="%LocalAppData%\\TaprintScreen" "%URL%"'."\r\n  exit /b\r\n)\r\n"
                .'for %%P in ("%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe") do if exist %%P ('."\r\n"
                .'  start "" %%P --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --user-data-dir="%LocalAppData%\\TaprintScreen"'."\r\n  exit /b\r\n)\r\n"
                ."echo Chrome or Edge was not found. Open this address in a browser: %URL%\r\npause\r\n";
            $zip->addFromString('print-agent/open-customer-screen.bat', $bat);
        }
        $zip->close();

        return $tmp;
    }
}
