"""
FlipSlab Scanner Companion v2.0
Programmatic WIA scanning with NAPS2-style settings UI.
No more Windows scan dialogs - full control from within the app.
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
VERSION = "2.0.0"
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

# Default scan settings for sports cards
DEFAULT_SETTINGS = {
    "dpi": 300,
    "color": True,
    "source": "feeder_duplex",
    "paper_size": "sport_card",
    "width_inches": 3.0,
    "height_inches": 4.0,
}

# Paper size presets (width x height in inches)
PAPER_SIZES = {
    "sport_card": ("Sport Card (2.5 x 3.5 in)", 3.0, 4.0),
    "sport_card_tight": ("Sport Card Tight (2.6 x 3.6 in)", 2.6, 3.6),
    "custom": ("Custom", 3.0, 4.0),
    "letter": ("Letter (8.5 x 11 in)", 8.5, 11.0),
    "legal": ("Legal (8.5 x 14 in)", 8.5, 14.0),
}

SOURCE_OPTIONS = {
    "feeder_duplex": "Feeder (Scan both sides)",
    "feeder_single": "Feeder (Single side)",
    "flatbed": "Flatbed",
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

    # Item Property IDs
    HORIZONTAL_RES = 6147
    VERTICAL_RES = 6148
    COLOR_MODE = 6146
    HORIZONTAL_START = 6149
    VERTICAL_START = 6150
    HORIZONTAL_EXTENT = 6151
    VERTICAL_EXTENT = 6152

    # Device Property IDs
    DOC_HANDLING_SELECT = 3088
    DOC_HANDLING_STATUS = 3087
    PAGES = 3096

    # Source flags
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
            return True
        except:
            return False

    def _set_device_prop(self, device, prop_id, value):
        try:
            device.Properties(prop_id).Value = value
            return True
        except:
            return False

    def _connect_device(self, device_id):
        """Connect to a WIA device by its ID."""
        import win32com.client
        mgr = self._get_manager()
        for i in range(1, mgr.DeviceInfos.Count + 1):
            info = mgr.DeviceInfos.Item(i)
            if info.DeviceID == device_id:
                return info.Connect()
        return None

    def scan_card(self, device_id, settings):
        """Scan programmatically without showing any dialog (like NAPS2).
        Falls back to native dialog if programmatic scan fails."""

        try:
            return self._scan_programmatic(device_id, settings)
        except Exception as prog_err:
            # Fallback to native dialog
            try:
                return self._scan_with_dialog(device_id, settings)
            except Exception as dialog_err:
                raise Exception(
                    f"Programmatic scan failed: {prog_err}\n\n"
                    f"Native dialog also failed: {dialog_err}\n\n"
                    f"Check that the scanner is ON and a card is in the feeder."
                )

    def _scan_programmatic(self, device_id, settings):
        """Direct WIA scan without UI - sets all properties programmatically."""
        import win32com.client

        dpi = settings.get("dpi", 300)
        color = settings.get("color", True)
        source = settings.get("source", "feeder_duplex")
        width_in = settings.get("width_inches", 3.0)
        height_in = settings.get("height_inches", 4.0)

        device = self._connect_device(device_id)
        if not device:
            raise Exception("Could not connect to scanner device.")

        # --- Configure source (feeder/flatbed/duplex) ---
        if source == "flatbed":
            self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FLATBED)
        elif source == "feeder_duplex":
            self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FEEDER | self.DUPLEX)
        else:
            self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FEEDER)

        # Set pages: 0 = scan all available, 1 = single, 2 = both sides
        if source == "feeder_duplex":
            self._set_device_prop(device, self.PAGES, 0)
        else:
            self._set_device_prop(device, self.PAGES, 1)

        # --- Configure scan item properties ---
        item = device.Items(1)

        # DPI
        self._set_prop(item, self.HORIZONTAL_RES, dpi)
        self._set_prop(item, self.VERTICAL_RES, dpi)

        # Color mode: 1=Color, 2=Grayscale, 4=B&W
        self._set_prop(item, self.COLOR_MODE, 1 if color else 2)

        # Scan area in pixels
        width_px = int(width_in * dpi)
        height_px = int(height_in * dpi)
        self._set_prop(item, self.HORIZONTAL_START, 0)
        self._set_prop(item, self.VERTICAL_START, 0)
        self._set_prop(item, self.HORIZONTAL_EXTENT, width_px)
        self._set_prop(item, self.VERTICAL_EXTENT, height_px)

        # --- Scan pages ---
        images = []
        max_pages = 2 if source == "feeder_duplex" else 1

        for page_num in range(max_pages):
            try:
                image_file = item.Transfer(self.WIA_FORMAT_BMP)
                if image_file:
                    tmp = os.path.join(tempfile.gettempdir(),
                                       f"flipslab_{int(time.time())}_{page_num+1}.bmp")
                    image_file.SaveFile(tmp)
                    img = Image.open(tmp).convert("RGB")
                    img = self._auto_crop(img, width_in, height_in, dpi)
                    images.append(img)
                    try:
                        os.remove(tmp)
                    except:
                        pass
            except Exception:
                if page_num == 0 and not images:
                    raise  # first page failed = real error
                break  # second page not available = normal for non-duplex

        if not images:
            raise Exception("Scanner returned no images.")

        return images

    def _scan_with_dialog(self, device_id, settings):
        """Fallback: scan using native WIA dialog."""
        import win32com.client

        dpi = settings.get("dpi", 300)
        color = settings.get("color", True)
        width_in = settings.get("width_inches", 3.0)
        height_in = settings.get("height_inches", 4.0)

        images = []
        dialog = win32com.client.Dispatch("WIA.CommonDialog")
        intent = 1 if color else 2

        image_file = dialog.ShowAcquireImage(
            1, intent, 1, self.WIA_FORMAT_BMP, False, True, False)

        if image_file:
            tmp = os.path.join(tempfile.gettempdir(), f"flipslab_{int(time.time())}_1.bmp")
            image_file.SaveFile(tmp)
            img = Image.open(tmp).convert("RGB")
            img = self._auto_crop(img, width_in, height_in, dpi)
            images.append(img)
            try:
                os.remove(tmp)
            except:
                pass

            # Try second page
            try:
                image_file2 = dialog.ShowAcquireImage(
                    1, intent, 1, self.WIA_FORMAT_BMP, False, False, False)
                if image_file2:
                    tmp2 = os.path.join(tempfile.gettempdir(), f"flipslab_{int(time.time())}_2.bmp")
                    image_file2.SaveFile(tmp2)
                    img2 = Image.open(tmp2).convert("RGB")
                    img2 = self._auto_crop(img2, width_in, height_in, dpi)
                    images.append(img2)
                    try:
                        os.remove(tmp2)
                    except:
                        pass
            except:
                pass

        if not images:
            raise Exception("No images returned from scanner dialog.")

        return images

    def _auto_crop(self, img, target_w_in, target_h_in, dpi):
        """Smart crop: detect card via background subtraction, crop tight, rotate 180°,
        enhance colors, add uniform gray margin."""
        import numpy as np
        from PIL import ImageEnhance, ImageOps, ImageFilter

        w, h = img.size
        target_w = int(target_w_in * dpi)
        target_h = int(target_h_in * dpi)

        # If image is already close to target size, just rotate
        if w <= target_w * 1.3 and h <= target_h * 1.3:
            cropped = img.rotate(180)
        else:
            arr = np.array(img, dtype=np.float32)

            # --- STEP 1: Detect background color from corners ---
            corner_size = 30
            corners = np.concatenate([
                arr[:corner_size, :corner_size].reshape(-1, 3),       # top-left
                arr[:corner_size, -corner_size:].reshape(-1, 3),      # top-right
                arr[-corner_size:, :corner_size].reshape(-1, 3),      # bottom-left
                arr[-corner_size:, -corner_size:].reshape(-1, 3),     # bottom-right
            ])
            bg_color = np.median(corners, axis=0)

            # --- STEP 2: Create difference mask (distance from background) ---
            diff = np.sqrt(np.sum((arr - bg_color) ** 2, axis=2))

            # Threshold: pixels more than 30 color-distance from background = card
            CARD_THRESH = 30
            card_mask = (diff > CARD_THRESH).astype(np.uint8)

            # --- STEP 3: Clean up mask with morphological ops ---
            # Use row/column density to find card bounds more robustly
            # A row/column belongs to the card if enough pixels are "card"
            MIN_DENSITY = 0.15  # at least 15% of pixels in row/col must be card

            row_density = card_mask.mean(axis=1)
            col_density = card_mask.mean(axis=0)

            card_rows = np.where(row_density > MIN_DENSITY)[0]
            card_cols = np.where(col_density > MIN_DENSITY)[0]

            if len(card_rows) == 0 or len(card_cols) == 0:
                cropped = img.rotate(180)
            else:
                # --- STEP 4: Find tight bounding box ---
                rmin = max(0, card_rows[0] - 3)
                rmax = min(arr.shape[0], card_rows[-1] + 4)
                cmin = max(0, card_cols[0] - 3)
                cmax = min(arr.shape[1], card_cols[-1] + 4)

                cropped = img.crop((cmin, rmin, cmax, rmax))
                cropped = cropped.rotate(180)

        # === ENHANCE COLORS ===
        cropped = ImageOps.autocontrast(cropped, cutoff=0.5)
        cropped = ImageEnhance.Sharpness(cropped).enhance(1.3)
        cropped = ImageEnhance.Color(cropped).enhance(1.15)
        cropped = ImageEnhance.Contrast(cropped).enhance(1.1)
        cropped = ImageEnhance.Brightness(cropped).enhance(1.02)

        # === ADD UNIFORM GRAY BORDER ===
        BORDER_COLOR = (206, 212, 218)  # subtle gray matching sample
        border_size = max(15, int(min(cropped.size) * 0.05))  # 5% of smallest dimension, min 15px
        cropped = ImageOps.expand(cropped, border=border_size, fill=BORDER_COLOR)

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

        # Source (like NAPS2)
        row_src = tk.Frame(frame, bg=BG3)
        row_src.pack(fill="x", pady=(0, 4))
        tk.Label(row_src, text="Source:", font=("Segoe UI", 8), fg=GRAY, bg=BG3, width=10, anchor="w").pack(side="left")
        self.source_var = tk.StringVar(value=s.get("source", "feeder_duplex"))
        source_display = [SOURCE_OPTIONS[k] for k in SOURCE_OPTIONS]
        self.source_combo = ttk.Combobox(row_src, values=source_display,
                                         state="readonly", font=("Segoe UI", 8), width=22)
        # Set current selection
        current_source = s.get("source", "feeder_duplex")
        source_keys = list(SOURCE_OPTIONS.keys())
        self.source_combo.current(source_keys.index(current_source) if current_source in source_keys else 0)
        self.source_combo.pack(side="left")

        # Paper Size (like NAPS2)
        row_paper = tk.Frame(frame, bg=BG3)
        row_paper.pack(fill="x", pady=(0, 4))
        tk.Label(row_paper, text="Paper size:", font=("Segoe UI", 8), fg=GRAY, bg=BG3, width=10, anchor="w").pack(side="left")
        paper_display = [PAPER_SIZES[k][0] for k in PAPER_SIZES]
        self.paper_combo = ttk.Combobox(row_paper, values=paper_display,
                                        state="readonly", font=("Segoe UI", 8), width=22)
        current_paper = s.get("paper_size", "sport_card")
        paper_keys = list(PAPER_SIZES.keys())
        self.paper_combo.current(paper_keys.index(current_paper) if current_paper in paper_keys else 0)
        self.paper_combo.pack(side="left")
        self.paper_combo.bind("<<ComboboxSelected>>", self._on_paper_change)

        # Color format (like NAPS2)
        row_color = tk.Frame(frame, bg=BG3)
        row_color.pack(fill="x", pady=(0, 4))
        tk.Label(row_color, text="Color:", font=("Segoe UI", 8), fg=GRAY, bg=BG3, width=10, anchor="w").pack(side="left")
        self.color_var = tk.StringVar(value="Color" if s.get("color", True) else "Grayscale")
        color_combo = ttk.Combobox(row_color, textvariable=self.color_var,
                                   values=["Color", "Grayscale"], state="readonly",
                                   font=("Segoe UI", 8), width=10)
        color_combo.pack(side="left")

        # DPI (like NAPS2)
        row_dpi = tk.Frame(frame, bg=BG3)
        row_dpi.pack(fill="x", pady=(0, 4))
        tk.Label(row_dpi, text="DPI:", font=("Segoe UI", 8), fg=GRAY, bg=BG3, width=10, anchor="w").pack(side="left")
        self.dpi_var = tk.StringVar(value=str(s.get("dpi", 300)))
        dpi_combo = ttk.Combobox(row_dpi, textvariable=self.dpi_var,
                                 values=["150", "200", "300", "600"],
                                 state="readonly", font=("Segoe UI", 8), width=6)
        dpi_combo.pack(side="left")

        # Custom scan area (shown only when paper_size = "custom")
        self.custom_area_frame = tk.Frame(frame, bg=BG3)

        row_area = tk.Frame(self.custom_area_frame, bg=BG3)
        row_area.pack(fill="x", pady=(0, 2))
        tk.Label(row_area, text="Scan area:", font=("Segoe UI", 8), fg=GRAY, bg=BG3, width=10, anchor="w").pack(side="left")

        self.width_var = tk.StringVar(value=str(s.get("width_inches", 3.0)))
        tk.Entry(row_area, textvariable=self.width_var, font=("Segoe UI", 8), bg=BG, fg=WHITE,
                 insertbackground=WHITE, relief="flat", width=5).pack(side="left", ipady=2)
        tk.Label(row_area, text=" x ", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(side="left")

        self.height_var = tk.StringVar(value=str(s.get("height_inches", 4.0)))
        tk.Entry(row_area, textvariable=self.height_var, font=("Segoe UI", 8), bg=BG, fg=WHITE,
                 insertbackground=WHITE, relief="flat", width=5).pack(side="left", ipady=2)
        tk.Label(row_area, text=" in", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(side="left")

        # Show custom area only if paper_size is custom
        if current_paper == "custom":
            self.custom_area_frame.pack(fill="x", pady=(0, 4))

        # Save button
        tk.Button(frame, text="Save Settings", font=("Segoe UI", 8, "bold"),
                  bg=BG, fg=GREEN, relief="flat", cursor="hand2",
                  command=self._save_settings).pack(fill="x", ipady=2, pady=(4, 0))

    def _on_paper_change(self, event=None):
        """Show/hide custom area fields based on paper size selection."""
        paper_keys = list(PAPER_SIZES.keys())
        idx = self.paper_combo.current()
        key = paper_keys[idx] if idx >= 0 else "sport_card"
        if key == "custom":
            self.custom_area_frame.pack(fill="x", pady=(0, 4))
        else:
            self.custom_area_frame.pack_forget()
            # Update width/height from preset
            _, w, h = PAPER_SIZES[key]
            self.width_var.set(str(w))
            self.height_var.set(str(h))

        # Save button
        tk.Button(frame, text="Save Settings", font=("Segoe UI", 8, "bold"),
                  bg=BG, fg=GREEN, relief="flat", cursor="hand2",
                  command=self._save_settings).pack(fill="x", ipady=2, pady=(4, 0))

    def _save_settings(self):
        try:
            # Get source key from combo index
            source_keys = list(SOURCE_OPTIONS.keys())
            source_idx = self.source_combo.current()
            source_key = source_keys[source_idx] if source_idx >= 0 else "feeder_duplex"

            # Get paper size key from combo index
            paper_keys = list(PAPER_SIZES.keys())
            paper_idx = self.paper_combo.current()
            paper_key = paper_keys[paper_idx] if paper_idx >= 0 else "sport_card"

            # Get width/height from preset or custom
            if paper_key != "custom":
                _, w_in, h_in = PAPER_SIZES[paper_key]
            else:
                w_in = float(self.width_var.get())
                h_in = float(self.height_var.get())

            self.scan_settings = {
                "dpi": int(self.dpi_var.get()),
                "color": self.color_var.get() == "Color",
                "source": source_key,
                "paper_size": paper_key,
                "width_inches": w_in,
                "height_inches": h_in,
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
