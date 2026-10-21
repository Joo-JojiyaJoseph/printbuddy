# Taprint Print Agent (one per shop PC)

One central website/backend serves many shops. Each shop PC runs its own copy of this program with **its own kiosk key and its own
printer**. An order started at a kiosk prints only on that kiosk's PC. Different shops can use different printers and SumatraPDF locations,
because those are set in each PC's `config.json`, not on the server. The kiosk screen itself is just a web page: open
`https://taprint.webfolks.in/kiosk?k=<kiosk code>` full-screen in a browser on that shop's PC (nothing to install for it).

Use this when the website is hosted online (cPanel/AWS). The server cannot reach your printer, so this small
program on the shop PC collects each **paid** order from the website and prints it with the PC's own printer and
SumatraPDF. The hosted server needs **no printer, no Windows paths, no SumatraPDF and no Poppler**: the server only handles scanning,
uploads, payment and the admin panel.

When an order needs page preparation (edited pages, several pages per sheet, page ranges, landscape, scaling), the server asks the
shop PC to draw the needed pages with **its own Poppler**, sends them back, assembles the final sheets and sends the finished
file for printing. Plain unedited documents and photos need no Poppler at all.

The shop PC only makes outgoing connections (like a web browser), so no router or firewall changes are needed.

## Fastest way: Download setup
In the admin panel (**Printer & kiosks**, or open the kiosk under **Kiosks**) click **Download setup** on a kiosk. You get a zip with the program and a
`config.json` that already holds that kiosk's key and the server address. On the shop PC: unzip it, install Node.js, SumatraPDF and Poppler,
optionally put the Poppler / printer details in `config.json`, then double-click `install-agent.bat`. Each download makes a new key for that kiosk
(the previous key stops working). The steps below describe the same thing done by hand.

## One-time setup

**On the hosted server (cPanel / admin panel)**
1. Admin panel, **Printer & kiosks**, **Connection settings**: set *How the server prints* to **Print from the shop PC**, Save.
   (You can clear the old SumatraPDF path; it is no longer used.)
2. In the **Kiosks** list click **Print key** on that shop's kiosk. Copy the key (shown once). Every shop/kiosk has its own key.
3. Run `php artisan migrate --force` once, because this update adds three small columns.

**On the shop Windows PC**
1. Install **SumatraPDF** (sumatrapdfreader.org), **Node.js 18 or newer** (nodejs.org, the LTS one) and **Poppler for Windows**
   (download the zip from github.com/oschwartz10612/poppler-windows/releases and unzip it, for example to `C:\poppler`).
2. Copy this `print-agent` folder to the PC, for example `C:\Taprint\print-agent`.
3. Double-click `install-agent.bat`. The first time it opens `config.json`: set
   - `server`: your backend address, e.g. `https://taprint-backend.webfolks.in` (no `/api/v1`)
   - `key`: this shop's print key
   - `printerName`: optional; empty = the Windows default printer, or the exact printer name
   - `popplerPath`: full path to `pdftoppm.exe` inside Poppler's `Library\bin` folder, e.g. `C:\\poppler\\Library\\bin\\pdftoppm.exe` (empty = found automatically in `C:\poppler` or on PATH)
   - `sumatraPath`: empty (found automatically in the standard folders) or the full path, with doubled backslashes
   Save, then run `install-agent.bat` again. It prints a test page and, if paper comes out, makes the program start by itself
   (hidden, no window) every time Windows signs in. That is the whole setup; there is nothing to run by hand afterwards.

To remove it, run `uninstall-agent.bat`. Logs are in `agent.log`. `start-agent.bat` still exists for running it visibly while testing.

## How it behaves
- Only paid orders are ever sent. Each is claimed by exactly one program, so it cannot print twice.
- If the PC is off or the program is closed, the customer sees a clear message after 3 minutes and staff can press **Retry print** later.
- The PDF is downloaded to a temporary folder, printed, and deleted. The website also deletes its copy after the PC reports back.
- If the printer refuses the job, the order is marked failed with a short reason (never a file path).
- "Printed" means SumatraPDF handed the job to Windows. Paper jams or an empty tray are not detected.
- A lost or leaked key: create a new one in the admin panel; the old one stops working at once.

Tests: `node --test agent.test.mjs`
