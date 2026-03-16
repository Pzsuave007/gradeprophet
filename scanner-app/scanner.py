"""
FlipSlab Scanner Companion v1.2
Duplex scanning with saved settings for sports cards.
"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from PIL import Image, ImageTk
import threading
import requests
import os
import io
import json
import time
import tempfile

# ─── Config ────────────────────────────────────────────────
APP_NAME = "FlipSlab Scanner"
VERSION = "1.2.0"
CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".flipslab_scanner.json")
SCAN_FOLDER = os.path.join(os.path.expanduser("~"), "FlipSlab Scans")

BG = "#0a0a0a"
BG2 = "#111111"
BG3 = "#1a1a1a"
BLUE = "#3b82f6"
GREEN = "#22c55e"
AMBER = "#f59e0b"
RED = "#ef4444"
WHITE = "#ffffff"
GRAY = "#9ca3af"
DARK_GRAY = "#4b5563"

# Default scan settings for sports cards (2.5" x 3.5" + margin)
DEFAULT_SETTINGS = {
    "dpi": 150,
    "color": True,
    "duplex": True,
    "width_inches": 3.0,    # slightly larger than card
    "height_inches": 4.0,
}


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def save_config(data):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f)


# ─── WIA Scanner ─────────────────────────────────────────
class WIAScanner:
    WIA_DEVICE_TYPE_SCANNER = 1
    WIA_FORMAT_BMP = "{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}"

    # Property IDs
    HORIZONTAL_RES = 6147
    VERTICAL_RES = 6148
    COLOR_MODE = 6146
    HORIZONTAL_START = 6149
    VERTICAL_START = 6150
    HORIZONTAL_EXTENT = 6151
    VERTICAL_EXTENT = 6152

    # Document handling
    DOC_HANDLING_SELECT = 3088
    DOC_HANDLING_STATUS = 3087
    PAGES = 3096

    FEEDER = 1
    FLATBED = 2
    DUPLEX = 4
    FEED_READY = 1

    def __init__(self):
        self.device_manager = None

    def _get_manager(self):
        import win32com.client
        if not self.device_manager:
            self.device_manager = win32com.client.Dispatch("WIA.DeviceManager")
        return self.device_manager

    def list_scanners(self):
        scanners = []
        try:
            mgr = self._get_manager()
            for i in range(1, mgr.DeviceInfos.Count + 1):
                info = mgr.DeviceInfos.Item(i)
                if info.Type == self.WIA_DEVICE_TYPE_SCANNER:
                    name = info.Properties("Name").Value
                    dev_id = info.DeviceID
                    scanners.append((dev_id, name))
        except Exception as e:
            raise Exception(f"Error listing scanners: {e}")
        return scanners

    def _set_prop(self, item, prop_id, value):
        try:
            item.Properties(prop_id).Value = value
        except:
            pass

    def _set_device_prop(self, device, prop_id, value):
        try:
            device.Properties(prop_id).Value = value
        except:
            pass

    def scan_card(self, device_id, settings):
        """Scan a card. Returns list of PIL Images."""
        import win32com.client

        dpi = settings.get("dpi", 150)
        color = settings.get("color", True)
        duplex = settings.get("duplex", True)
        width_in = settings.get("width_inches", 3.0)
        height_in = settings.get("height_inches", 4.0)
        color_mode = 2 if color else 1

        images = []

        # First, configure device properties
        try:
            mgr = self._get_manager()
            device = None
            for i in range(1, mgr.DeviceInfos.Count + 1):
                info = mgr.DeviceInfos.Item(i)
                if info.DeviceID == device_id:
                    device = info.Connect()
                    break

            if device:
                # Set duplex mode
                if duplex:
                    self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FEEDER | self.DUPLEX)
                else:
                    self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FEEDER)

                # Set properties on all items
                for idx in range(1, device.Items.Count + 1):
                    try:
                        item = device.Items(idx)
                        self._set_prop(item, self.HORIZONTAL_RES, dpi)
                        self._set_prop(item, self.VERTICAL_RES, dpi)
                        self._set_prop(item, self.COLOR_MODE, color_mode)
                    except:
                        pass
        except:
            pass

        # Use CommonDialog to scan (most compatible with Fujitsu)
        dialog = win32com.client.Dispatch("WIA.CommonDialog")

        # Scan front side
        try:
            # Intent: 1=Color, 2=Grayscale, 4=Text
            intent = 1 if color else 2
            image_file = dialog.ShowAcquireImage(
                1,      # DeviceType: Scanner
                intent, # Intent
                1,      # Bias: MaxQuality
                self.WIA_FORMAT_BMP,
                False,  # AlwaysSelectDevice (don't ask which scanner)
                False,  # UseCommonUI = FALSE (no dialog, scan silent!)
                False   # CancelError
            )

            if image_file:
                tmp = os.path.join(tempfile.gettempdir(), f"flipslab_{int(time.time())}_front.bmp")
                image_file.SaveFile(tmp)
                img = Image.open(tmp).convert("RGB")
                img = self._auto_crop(img, width_in, height_in, dpi)
                images.append(img)
                try:
                    os.remove(tmp)
                except:
                    pass
        except Exception as e:
            # If silent mode fails, try WITH UI
            try:
                image_file = dialog.ShowAcquireImage(1, 1, 1, self.WIA_FORMAT_BMP, False, True, False)
                if image_file:
                    tmp = os.path.join(tempfile.gettempdir(), f"flipslab_{int(time.time())}_front.bmp")
                    image_file.SaveFile(tmp)
                    img = Image.open(tmp).convert("RGB")
                    img = self._auto_crop(img, width_in, height_in, dpi)
                    images.append(img)
                    try:
                        os.remove(tmp)
                    except:
                        pass
            except Exception as e2:
                raise Exception(
                    f"Scan failed.\n\n"
                    f"1. Is the card in the feeder?\n"
                    f"2. Is the scanner on?\n\n"
                    f"Error: {e2}"
                )

        # Scan back side (if duplex and got front)
        if duplex and images:
            try:
                image_file = dialog.ShowAcquireImage(1, 1 if color else 2, 1,
                    self.WIA_FORMAT_BMP, False, False, False)
                if image_file:
                    tmp = os.path.join(tempfile.gettempdir(), f"flipslab_{int(time.time())}_back.bmp")
                    image_file.SaveFile(tmp)
                    img = Image.open(tmp).convert("RGB")
                    img = self._auto_crop(img, width_in, height_in, dpi)
                    images.append(img)
                    try:
                        os.remove(tmp)
                    except:
                        pass
            except:
                pass  # Back side not available, that's ok

        return images

    def _auto_crop(self, img, target_w_in, target_h_in, dpi):
        """Smart crop: detect card in scanned page using tile analysis, crop it, rotate 180°."""
        import numpy as np

        w, h = img.size
        target_w = int(target_w_in * dpi)
        target_h = int(target_h_in * dpi)

        # If image is already close to target size, just rotate
        if w <= target_w * 1.3 and h <= target_h * 1.3:
            return img.rotate(180)

        arr = np.array(img)

        # Tile-based detection: find tiles with high color variance (= card content)
        tile_size = 50
        card_tiles = []

        for r in range(0, arr.shape[0], tile_size):
            for c in range(0, arr.shape[1], tile_size):
                tile = arr[r:r+tile_size, c:c+tile_size]
                if tile.size == 0:
                    continue
                # Card tiles have high variance (colorful) and aren't pure white
                if tile.std() > 35 and tile.mean() < 220:
                    card_tiles.append((r, c))

        if not card_tiles:
            return img.rotate(180)

        rows = [t[0] for t in card_tiles]
        cols = [t[1] for t in card_tiles]
        rmin = max(0, min(rows) - 20)
        rmax = min(arr.shape[0], max(rows) + tile_size + 20)
        cmin = max(0, min(cols) - 20)
        cmax = min(arr.shape[1], max(cols) + tile_size + 20)

        cropped = img.crop((cmin, rmin, cmax, rmax))

        # Rotate 180° (ADF feeds cards upside down)
        cropped = cropped.rotate(180)

        return cropped


# ─── Main App ────────────────────────────────────────────
class FlipSlabScanner:
    def __init__(self, root):
        self.root = root
        self.root.title(f"{APP_NAME} v{VERSION}")
        self.root.geometry("960x720")
        self.root.configure(bg=BG)
        self.root.minsize(800, 600)

        self.config = load_config()
        self.server_url = self.config.get("server_url", "https://flipslabengine.com")
        self.scan_settings = self.config.get("scan_settings", DEFAULT_SETTINGS.copy())
        self.session_cookie = None
        self.logged_in = False
        self.scanned_images = []
        self.scanning = False

        self.wia = WIAScanner()
        self.scanners = []
        self.selected_scanner_id = None

        os.makedirs(SCAN_FOLDER, exist_ok=True)
        self._build_ui()

    def _build_ui(self):
        top = tk.Frame(self.root, bg=BG2, height=50)
        top.pack(fill="x")
        top.pack_propagate(False)

        tk.Label(top, text="FLIPSLAB SCANNER", font=("Segoe UI", 12, "bold"),
                 fg=BLUE, bg=BG2).pack(side="left", padx=15)

        self.status_label = tk.Label(top, text="Not connected", font=("Segoe UI", 9),
                                     fg=GRAY, bg=BG2)
        self.status_label.pack(side="right", padx=15)

        self.user_label = tk.Label(top, text="", font=("Segoe UI", 9, "bold"),
                                   fg=GREEN, bg=BG2)
        self.user_label.pack(side="right", padx=5)

        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True, padx=15, pady=10)

        left = tk.Frame(main, bg=BG, width=290)
        left.pack(side="left", fill="y", padx=(0, 10))
        left.pack_propagate(False)

        self._build_login_section(left)
        self._build_scanner_section(left)
        self._build_settings_section(left)
        self._build_actions_section(left)
        self._build_queue_section(left)

        # Right - Preview
        right = tk.Frame(main, bg=BG2, relief="flat", bd=1)
        right.pack(side="right", fill="both", expand=True)

        self.preview_label = tk.Label(right, text="Scan a card to preview",
                                      font=("Segoe UI", 11), fg=DARK_GRAY, bg=BG2)
        self.preview_label.pack(expand=True)

    def _section_title(self, parent, text):
        tk.Label(parent, text=text, font=("Segoe UI", 8, "bold"),
                 fg=DARK_GRAY, bg=BG, anchor="w").pack(fill="x", pady=(10, 3))

    def _build_login_section(self, parent):
        self._section_title(parent, "FLIPSLAB ACCOUNT")

        self.login_frame = tk.Frame(parent, bg=BG3)
        self.login_frame.pack(fill="x")

        inner = tk.Frame(self.login_frame, bg=BG3, padx=10, pady=6)
        inner.pack(fill="x")

        tk.Label(inner, text="Server URL", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.url_entry = tk.Entry(inner, font=("Segoe UI", 9), bg=BG, fg=WHITE,
                                  insertbackground=WHITE, relief="flat", bd=0)
        self.url_entry.pack(fill="x", pady=(1, 4), ipady=3)
        self.url_entry.insert(0, self.server_url)

        tk.Label(inner, text="Email", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.email_entry = tk.Entry(inner, font=("Segoe UI", 9), bg=BG, fg=WHITE,
                                    insertbackground=WHITE, relief="flat", bd=0)
        self.email_entry.pack(fill="x", pady=(1, 4), ipady=3)
        self.email_entry.insert(0, self.config.get("email", ""))

        tk.Label(inner, text="Password", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.pass_entry = tk.Entry(inner, font=("Segoe UI", 9), bg=BG, fg=WHITE,
                                   insertbackground=WHITE, relief="flat", bd=0, show="*")
        self.pass_entry.pack(fill="x", pady=(1, 4), ipady=3)

        self.login_btn = tk.Button(inner, text="Connect", font=("Segoe UI", 9, "bold"),
                                   bg=BLUE, fg=WHITE, relief="flat", cursor="hand2",
                                   command=self._login)
        self.login_btn.pack(fill="x", ipady=3, pady=(2, 0))

        self.connected_frame = tk.Frame(parent, bg=BG3)
        conn_inner = tk.Frame(self.connected_frame, bg=BG3, padx=10, pady=6)
        conn_inner.pack(fill="x")
        self.connected_label = tk.Label(conn_inner, text="", font=("Segoe UI", 9), fg=GREEN, bg=BG3)
        self.connected_label.pack(anchor="w")
        tk.Button(conn_inner, text="Disconnect", font=("Segoe UI", 8),
                  bg=BG, fg=RED, relief="flat", cursor="hand2",
                  command=self._logout).pack(fill="x", ipady=2, pady=(3, 0))

    def _build_scanner_section(self, parent):
        self._section_title(parent, "SCANNER")

        frame = tk.Frame(parent, bg=BG3, padx=10, pady=6)
        frame.pack(fill="x")

        self.scanner_combo = ttk.Combobox(frame, state="readonly", font=("Segoe UI", 9))
        self.scanner_combo.pack(fill="x", pady=(0, 4))
        self.scanner_combo.set("Click 'Detect' to find scanners")

        btn_row = tk.Frame(frame, bg=BG3)
        btn_row.pack(fill="x")

        self.detect_btn = tk.Button(btn_row, text="Detect Scanners", font=("Segoe UI", 8, "bold"),
                                    bg=BG, fg=AMBER, relief="flat", cursor="hand2",
                                    command=self._detect_scanners)
        self.detect_btn.pack(side="left", expand=True, fill="x", padx=(0, 3), ipady=2)

        self.select_btn = tk.Button(btn_row, text="Select", font=("Segoe UI", 8, "bold"),
                                    bg=BG, fg=BLUE, relief="flat", cursor="hand2",
                                    command=self._select_scanner)
        self.select_btn.pack(side="right", expand=True, fill="x", padx=(3, 0), ipady=2)

        self.scanner_status = tk.Label(frame, text="No scanner selected", font=("Segoe UI", 8),
                                       fg=DARK_GRAY, bg=BG3)
        self.scanner_status.pack(anchor="w", pady=(3, 0))

    def _build_settings_section(self, parent):
        self._section_title(parent, "SCAN SETTINGS")

        frame = tk.Frame(parent, bg=BG3, padx=10, pady=6)
        frame.pack(fill="x")

        s = self.scan_settings

        # DPI
        row1 = tk.Frame(frame, bg=BG3)
        row1.pack(fill="x", pady=(0, 4))
        tk.Label(row1, text="DPI:", font=("Segoe UI", 8), fg=GRAY, bg=BG3, width=8, anchor="w").pack(side="left")
        self.dpi_var = tk.StringVar(value=str(s.get("dpi", 150)))
        dpi_combo = ttk.Combobox(row1, textvariable=self.dpi_var, values=["100", "150", "200", "300"],
                                 state="readonly", font=("Segoe UI", 8), width=6)
        dpi_combo.pack(side="left", padx=(0, 10))

        # Color
        self.color_var = tk.BooleanVar(value=s.get("color", True))
        tk.Checkbutton(row1, text="Color", variable=self.color_var, font=("Segoe UI", 8),
                       fg=WHITE, bg=BG3, selectcolor=BG, activebackground=BG3,
                       activeforeground=WHITE).pack(side="left")

        # Duplex
        row2 = tk.Frame(frame, bg=BG3)
        row2.pack(fill="x", pady=(0, 4))
        self.duplex_var = tk.BooleanVar(value=s.get("duplex", True))
        tk.Checkbutton(row2, text="Duplex (front + back)", variable=self.duplex_var,
                       font=("Segoe UI", 8), fg=WHITE, bg=BG3, selectcolor=BG,
                       activebackground=BG3, activeforeground=WHITE).pack(anchor="w")

        # Scan area
        row3 = tk.Frame(frame, bg=BG3)
        row3.pack(fill="x", pady=(0, 2))
        tk.Label(row3, text="Scan area:", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(side="left")

        self.width_var = tk.StringVar(value=str(s.get("width_inches", 3.0)))
        tk.Entry(row3, textvariable=self.width_var, font=("Segoe UI", 8), bg=BG, fg=WHITE,
                 insertbackground=WHITE, relief="flat", width=5).pack(side="left", padx=(4, 0), ipady=2)
        tk.Label(row3, text="x", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(side="left", padx=3)

        self.height_var = tk.StringVar(value=str(s.get("height_inches", 4.0)))
        tk.Entry(row3, textvariable=self.height_var, font=("Segoe UI", 8), bg=BG, fg=WHITE,
                 insertbackground=WHITE, relief="flat", width=5).pack(side="left", ipady=2)
        tk.Label(row3, text="inches", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(side="left", padx=3)

        # Card size hint
        tk.Label(frame, text="Sports card = 2.5 x 3.5 in (default adds margin)",
                 font=("Segoe UI", 7), fg=DARK_GRAY, bg=BG3).pack(anchor="w")

        # Save button
        tk.Button(frame, text="Save Settings", font=("Segoe UI", 8, "bold"),
                  bg=BG, fg=GREEN, relief="flat", cursor="hand2",
                  command=self._save_settings).pack(fill="x", ipady=2, pady=(4, 0))

    def _save_settings(self):
        try:
            self.scan_settings = {
                "dpi": int(self.dpi_var.get()),
                "color": self.color_var.get(),
                "duplex": self.duplex_var.get(),
                "width_inches": float(self.width_var.get()),
                "height_inches": float(self.height_var.get()),
            }
            self.config["scan_settings"] = self.scan_settings
            save_config(self.config)
            messagebox.showinfo("Saved", "Scan settings saved!")
        except ValueError:
            messagebox.showwarning("Invalid", "Check your numbers (DPI, width, height).")

    def _build_actions_section(self, parent):
        self._section_title(parent, "ACTIONS")

        frame = tk.Frame(parent, bg=BG)
        frame.pack(fill="x")

        self.scan_btn = tk.Button(frame, text="SCAN CARD", font=("Segoe UI", 10, "bold"),
                                  bg=GREEN, fg=WHITE, relief="flat", cursor="hand2",
                                  command=self._scan_card, state="disabled")
        self.scan_btn.pack(fill="x", ipady=6, pady=(0, 3))

        btn_row = tk.Frame(frame, bg=BG)
        btn_row.pack(fill="x")

        self.upload_btn = tk.Button(btn_row, text="Upload to FlipSlab", font=("Segoe UI", 9, "bold"),
                                    bg=BLUE, fg=WHITE, relief="flat", cursor="hand2",
                                    command=self._upload_all, state="disabled")
        self.upload_btn.pack(side="left", expand=True, fill="x", padx=(0, 3), ipady=4)

        self.clear_btn = tk.Button(btn_row, text="Clear", font=("Segoe UI", 9),
                                   bg=BG3, fg=GRAY, relief="flat", cursor="hand2",
                                   command=self._clear_all)
        self.clear_btn.pack(side="right", ipady=4, ipadx=8)

        self.import_btn = tk.Button(frame, text="Import from folder...", font=("Segoe UI", 8),
                                    bg=BG3, fg=GRAY, relief="flat", cursor="hand2",
                                    command=self._import_folder)
        self.import_btn.pack(fill="x", ipady=2, pady=(3, 0))

    def _build_queue_section(self, parent):
        self._section_title(parent, "SCAN QUEUE")

        self.queue_frame = tk.Frame(parent, bg=BG)
        self.queue_frame.pack(fill="both", expand=True)

        self.queue_listbox = tk.Listbox(self.queue_frame, font=("Segoe UI", 8),
                                        bg=BG2, fg=WHITE, selectbackground=BLUE,
                                        relief="flat", bd=0, activestyle="none")
        self.queue_listbox.pack(fill="both", expand=True)
        self.queue_listbox.bind("<<ListboxSelect>>", self._on_queue_select)

        self.queue_count = tk.Label(parent, text="0 cards scanned", font=("Segoe UI", 8),
                                    fg=DARK_GRAY, bg=BG)
        self.queue_count.pack(anchor="w", pady=(2, 0))

    # ─── Login ───────────────────────────────────────────
    def _login(self):
        url = self.url_entry.get().strip().rstrip("/")
        email = self.email_entry.get().strip()
        password = self.pass_entry.get().strip()
        if not all([url, email, password]):
            messagebox.showwarning("Missing Info", "Please fill all fields.")
            return

        self.server_url = url
        self.login_btn.config(text="Connecting...", state="disabled")
        self.root.update()

        def do_login():
            try:
                resp = requests.post(f"{url}/api/auth/login",
                                     json={"email": email, "password": password}, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    self.session_cookie = resp.cookies.get("session_token")
                    self.root.after(0, lambda: self._on_login_success(data, email))
                else:
                    self.root.after(0, lambda: self._on_login_fail(resp.text))
            except Exception as e:
                self.root.after(0, lambda: self._on_login_fail(str(e)))

        threading.Thread(target=do_login, daemon=True).start()

    def _on_login_success(self, data, email):
        self.logged_in = True
        name = data.get("name", email)
        self.config["server_url"] = self.server_url
        self.config["email"] = email
        save_config(self.config)
        self.login_frame.pack_forget()
        self.connected_label.config(text=f"Connected: {name}")
        self.connected_frame.pack(fill="x")
        self.user_label.config(text=name)
        self.status_label.config(text="Connected", fg=GREEN)
        self._update_buttons()

    def _on_login_fail(self, error):
        self.login_btn.config(text="Connect", state="normal")
        messagebox.showerror("Login Failed", f"Could not connect:\n{error}")

    def _logout(self):
        self.logged_in = False
        self.session_cookie = None
        self.connected_frame.pack_forget()
        self.login_frame.pack(fill="x")
        self.login_btn.config(text="Connect", state="normal")
        self.user_label.config(text="")
        self.status_label.config(text="Disconnected", fg=GRAY)
        self._update_buttons()

    # ─── Scanner ─────────────────────────────────────────
    def _detect_scanners(self):
        self.detect_btn.config(text="Detecting...", state="disabled")
        self.root.update()

        def do_detect():
            scanners, error = [], None
            try:
                scanners = self.wia.list_scanners()
            except Exception as e:
                error = str(e)
            self.root.after(0, lambda: self._on_detect_done(scanners, error))

        threading.Thread(target=do_detect, daemon=True).start()

    def _on_detect_done(self, scanners, error):
        self.detect_btn.config(text="Detect Scanners", state="normal")
        if error:
            messagebox.showerror("Error", error)
            return
        if not scanners:
            self.scanner_combo.set("No scanners found")
            messagebox.showinfo("No Scanners",
                "No scanners found.\n\nCheck:\n1. Scanner connected via USB\n2. Scanner turned ON\n3. Drivers installed")
            return
        self.scanners = scanners
        self.scanner_combo["values"] = [name for _, name in scanners]
        self.scanner_combo.current(0)
        self.scanner_status.config(text=f"{len(scanners)} scanner(s) found", fg=AMBER)

    def _select_scanner(self):
        idx = self.scanner_combo.current()
        if idx < 0 or not self.scanners:
            messagebox.showwarning("Select Scanner", "Detect and select a scanner first.")
            return
        self.selected_scanner_id = self.scanners[idx][0]
        name = self.scanners[idx][1]
        self.scanner_status.config(text=f"Ready: {name}", fg=GREEN)
        self._update_buttons()

    # ─── Scan ────────────────────────────────────────────
    def _scan_card(self):
        if not self.selected_scanner_id:
            messagebox.showwarning("No Scanner", "Select a scanner first.")
            return

        self.scan_btn.config(text="Scanning...", state="disabled")
        self.root.update()

        images = []
        error = None
        try:
            images = self.wia.scan_card(self.selected_scanner_id, self.scan_settings)
        except Exception as e:
            error = str(e)

        self.scan_btn.config(text="SCAN CARD", state="normal")

        if error:
            messagebox.showerror("Scan Error", error)
            return

        if not images:
            messagebox.showwarning("No Image", "Scanner didn't return an image.\nIs there a card in the feeder?")
            return

        # Save each scanned image
        timestamp = int(time.time() * 1000)
        sides = ["front", "back"]
        for i, img in enumerate(images):
            side = sides[i] if i < len(sides) else f"page{i+1}"
            filename = f"card_{timestamp}_{side}.png"
            filepath = os.path.join(SCAN_FOLDER, filename)
            img.save(filepath, "PNG")
            self.scanned_images.append({"path": filepath, "name": filename, "uploaded": False})
            self.queue_listbox.insert(tk.END, f"  {filename}")

        self.queue_count.config(text=f"{len(self.scanned_images)} image(s) scanned")
        self._show_preview(self.scanned_images[-len(images)]["path"])
        self._update_buttons()

        side_text = "front + back" if len(images) > 1 else "front only"
        messagebox.showinfo("Scan Complete",
            f"Card scanned! ({side_text})\n"
            f"{len(images)} image(s) saved.\n\n"
            f"Saved to: {SCAN_FOLDER}")

    # ─── Import ──────────────────────────────────────────
    def _import_folder(self):
        folder = filedialog.askdirectory(title="Select folder with scanned images")
        if not folder:
            return
        count = 0
        for f in sorted(os.listdir(folder)):
            if f.lower().split(".")[-1] in ("png", "jpg", "jpeg", "bmp", "tiff", "tif"):
                filepath = os.path.join(folder, f)
                self.scanned_images.append({"path": filepath, "name": f, "uploaded": False})
                self.queue_listbox.insert(tk.END, f"  {f}")
                count += 1
        if count:
            self.queue_count.config(text=f"{len(self.scanned_images)} image(s)")
            self._show_preview(self.scanned_images[-1]["path"])
            self._update_buttons()
            messagebox.showinfo("Imported", f"{count} images imported!")

    # ─── Preview ─────────────────────────────────────────
    def _show_preview(self, filepath):
        try:
            img = Image.open(filepath)
            # Use fixed size for preview (don't rely on widget size)
            img.thumbnail((500, 500), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            self.preview_label.config(image=photo, text="")
            self.preview_label.image = photo
        except Exception as e:
            self.preview_label.config(text=f"Saved to: {filepath}", image="")

    def _on_queue_select(self, event):
        sel = self.queue_listbox.curselection()
        if sel and sel[0] < len(self.scanned_images):
            self._show_preview(self.scanned_images[sel[0]]["path"])

    # ─── Upload ──────────────────────────────────────────
    def _upload_all(self):
        if not self.logged_in:
            messagebox.showwarning("Not Connected", "Connect to FlipSlab first.")
            return
        pending = [img for img in self.scanned_images if not img["uploaded"]]
        if not pending:
            messagebox.showinfo("Done", "All cards already uploaded.")
            return

        self.upload_btn.config(text=f"Uploading 0/{len(pending)}...", state="disabled")
        self.root.update()

        def do_upload():
            success = 0
            for i, img in enumerate(pending):
                try:
                    self.root.after(0, lambda i=i: self.upload_btn.config(
                        text=f"Uploading {i+1}/{len(pending)}..."))
                    with open(img["path"], "rb") as f:
                        resp = requests.post(
                            f"{self.server_url}/api/cards/scan-upload",
                            files={"file": (img["name"], f, "image/png")},
                            cookies={"session_token": self.session_cookie} if self.session_cookie else {},
                            timeout=60,
                        )
                    if resp.status_code == 200:
                        img["uploaded"] = True
                        success += 1
                        idx = self.scanned_images.index(img)
                        self.root.after(0, lambda idx=idx, n=img["name"]: self._mark_uploaded(idx, n))
                except Exception as e:
                    print(f"Upload error: {e}")
            self.root.after(0, lambda: self._on_upload_done(success, len(pending)))

        threading.Thread(target=do_upload, daemon=True).start()

    def _mark_uploaded(self, idx, name):
        self.queue_listbox.delete(idx)
        self.queue_listbox.insert(idx, f"  {name}  [UPLOADED]")
        self.queue_listbox.itemconfig(idx, fg=GREEN)

    def _on_upload_done(self, success, total):
        self.upload_btn.config(text="Upload to FlipSlab", state="normal")
        messagebox.showinfo("Upload", f"{success}/{total} uploaded!\nAI will identify each card.")
        self._update_buttons()

    # ─── Clear ───────────────────────────────────────────
    def _clear_all(self):
        if self.scanned_images and not messagebox.askyesno("Clear", "Remove all from queue?"):
            return
        self.scanned_images.clear()
        self.queue_listbox.delete(0, tk.END)
        self.queue_count.config(text="0 cards scanned")
        self.preview_label.config(text="Scan a card to preview", image="")
        self.preview_label.image = None
        self._update_buttons()

    def _update_buttons(self):
        has_scanner = self.selected_scanner_id is not None
        has_images = any(not img["uploaded"] for img in self.scanned_images)
        self.scan_btn.config(state="normal" if has_scanner else "disabled")
        self.upload_btn.config(state="normal" if (self.logged_in and has_images) else "disabled")


if __name__ == "__main__":
    root = tk.Tk()
    style = ttk.Style()
    style.theme_use("clam")
    style.configure("TCombobox", fieldbackground=BG, background=BG3, foreground=WHITE,
                    selectbackground=BLUE, borderwidth=0)
    app = FlipSlabScanner(root)
    root.mainloop()
