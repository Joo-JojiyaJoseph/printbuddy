<?php

/*
 | Taprint runtime configuration. Operational limits that an administrator may change at
 | runtime live in the `settings` table (see App\Support\Settings); the values here are the
 | defaults used until an admin overrides them, plus deployment-only knobs.
 */
return [
    // Public origin of the React app; QR codes and CORS use it.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    // Private disk that holds uploaded documents and converted previews. Never a public disk.
    'documents_disk' => env('DOCUMENTS_DISK', 'documents'),

    // Admin-tunable defaults (overridable from the settings table).
    'defaults' => [
        'session_ttl_minutes' => (int) env('SESSION_TTL_MINUTES', 15),
        'payment_ttl_minutes' => (int) env('PAYMENT_TTL_MINUTES', 5),
        'document_retention_hours' => (int) env('DOCUMENT_RETENTION_HOURS', 24),
        'max_upload_mb' => (int) env('MAX_UPLOAD_MB', 25),
        'max_files' => (int) env('MAX_FILES_PER_SESSION', 10),
        'max_pages' => (int) env('MAX_PAGES_PER_DOCUMENT', 500),
        'max_copies' => (int) env('MAX_COPIES', 100),
        'allowed_types' => ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
        'paper_sizes' => ['A4', 'A5', 'Letter'],
        'duplex_discount_bps' => 1000,
        'service_fee_paise' => 0,
        'tax_bps' => 0,
    ],

    'conversion' => [
        // 'libreoffice' runs soffice --headless; 'none' marks Office files as unconvertible; 'fake' is tests only.
        'driver' => env('CONVERSION_DRIVER', 'libreoffice'),
        'soffice_path' => env('SOFFICE_PATH', 'soffice'),
        'timeout_seconds' => (int) env('CONVERSION_TIMEOUT', 90),
        'max_attempts' => 3,
    ],

    'printing' => [
        // 'file' = save the print-ready PDF to a folder (development, no printer); 'cups' = lp (Linux/macOS); 'sumatra' = SumatraPDF (Windows).
        'driver' => env('PRINT_DRIVER', 'file'),
        'printer' => env('PRINTER_NAME', ''),           // empty = the system default printer
        'lp_path' => env('LP_PATH', ''),
        'sumatra_path' => env('SUMATRA_PATH', ''),
        'pdftoppm_path' => env('PDFTOPPM_PATH', ''),
        'pdfunite_path' => env('PDFUNITE_PATH', ''),
        'dpi' => (int) env('PRINT_DPI', 300),
        'timeout_seconds' => (int) env('PRINT_TIMEOUT', 120),
        // Privacy: files of a printed order are erased this many minutes after the print was sent (0 = keep until normal retention).
        'erase_after_minutes' => (int) env('PRINT_ERASE_MINUTES', 10),
        'output_dir' => env('PRINT_OUTPUT_DIR', ''),     // file driver; defaults to storage/app/printed
    ],

    'payment' => [
        // 'fake' = built-in sandbox provider (never for production). 'razorpay' = Razorpay UPI QR codes.
        'provider' => env('PAYMENT_PROVIDER', 'fake'),
        'webhook_secret' => env('PAYMENT_WEBHOOK_SECRET', ''),
        'razorpay' => [
            'key_id' => env('RAZORPAY_KEY_ID', ''),
            'key_secret' => env('RAZORPAY_KEY_SECRET', ''),
            'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET', ''),
            'base_url' => env('RAZORPAY_BASE_URL', 'https://api.razorpay.com/v1'),
        ],
    ],
];
