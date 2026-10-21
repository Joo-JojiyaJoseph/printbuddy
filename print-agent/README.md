# Taprint Print Agent (one per shop PC)

One central website/backend serves many shops. Each shop PC runs its own copy of this program with **its own kiosk key and its own
printer**. An order started at a kiosk prints only on that kiosk's PC. Different shops can use different printers and SumatraPDF locations,
because those are set in each PC's `config.json`, not on the server. The kiosk screen itself is just a web page: open
`https://taprint.webfolks.in/kiosk?k=<kiosk code>` full-screen in a browser on that shop's PC (nothing to install for it).

Use this when the website is hosted online (cPanel/AWS). The server cannot reach your printer, so this small
program on the shop PC collects each **paid** order from the website and prints it with the PC's own printer and
SumatraPDF. The hosted server needs **no printer, no Windows paths and no SumatraPDF**.

The shop PC only makes outgoing connections (like a web browser), so no router or firewall changes are needed.

## One-time setup

**On the hosted server (cPanel / admin panel)**
1. Admin panel, **Printer & kiosks**, **Connection settings**: set *How the server prints* to **Print from the shop PC**, Save.
   (You can clear the old SumatraPDF path; it is no longer used.)
2. In the **Kiosks** list click **Print key** on that shop's kiosk. Copy the key (shown once). Every shop/kiosk has its own key.
3. Run `php artisan migrate --force` once, because this update adds three small columns.

**On the shop Windows PC**
1. Install **SumatraPDF** (sumatrapdfreader.org) and **Node.js 18 or newer** (nodejs.org, the LTS one).
2. Copy this `print-agent` folder to the PC, for example `C:\Taprint\print-agent`.
3. Double-click `start-agent.bat`. The first time it opens `config.json`: set
   - `server`: your backend address, e.g. `https://taprint-backend.webfolks.in`
   - `key`: the key you copied
   - `printerName`: optional; leave empty for the Windows default printer, or type the exact printer name
   - `sumatraPath`: leave empty (found automatically) or give the full path to `SumatraPDF.exe`
4. Double-click `test-agent.bat` to print a test page. When paper comes out, run `start-agent.bat` and leave the window open.

## Keep it running
Press `Win+R`, type `shell:startup`, and put a shortcut to `start-agent.bat` there. It then starts when the PC signs in, and
restarts itself if it stops. The admin panel shows **Shop PC print program is running** while it is connected.

## How it behaves
- Only paid orders are ever sent. Each is claimed by exactly one program, so it cannot print twice.
- If the PC is off or the program is closed, the customer sees a clear message after 3 minutes and staff can press **Retry print** later.
- The PDF is downloaded to a temporary folder, printed, and deleted. The website also deletes its copy after the PC reports back.
- If the printer refuses the job, the order is marked failed with a short reason (never a file path).
- "Printed" means SumatraPDF handed the job to Windows. Paper jams or an empty tray are not detected.
- A lost or leaked key: create a new one in the admin panel; the old one stops working at once.

Tests: `node --test agent.test.mjs`
