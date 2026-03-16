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
    "naps2_path": "",
    "naps2_device": "fi-6130dj",
    "naps2_profile": "",
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

    def scan_card(self, device_id, settings, window_handle=0, scanner_name=""):
        """Scan card(s). Uses NAPS2 CLI for duplex (both sides), WIA for single side."""
        source = settings.get("source", "feeder_duplex")
        is_duplex = source == "feeder_duplex"

        # For duplex: ONLY use NAPS2 CLI (WIA cannot do duplex reliably)
        if is_duplex:
            return self._scan_naps2(settings, scanner_name)

        # Single side: try WIA programmatic, then dialog
        try:
            return self._scan_programmatic(device_id, settings)
        except Exception:
            pass
        return self._scan_with_dialog(device_id, settings)

    def _find_naps2(self, custom_path=None):
        """Find NAPS2 installation path. Checks custom path, common locations, and PATH."""
        import shutil

        # 1. Check custom configured path
        if custom_path and os.path.isfile(custom_path):
            return custom_path

        # 2. Check common installation paths
        search_paths = []
        for env_var in ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"]:
            base = os.environ.get(env_var, "")
            if base:
                search_paths.append(os.path.join(base, "NAPS2", "NAPS2.Console.exe"))
                search_paths.append(os.path.join(base, "NAPS2", "App", "NAPS2.Console.exe"))

        # Also check user profile paths
        userprofile = os.environ.get("USERPROFILE", "")
        if userprofile:
            search_paths.append(os.path.join(userprofile, "AppData", "Local", "Programs", "NAPS2", "NAPS2.Console.exe"))
            search_paths.append(os.path.join(userprofile, "Downloads", "NAPS2", "NAPS2.Console.exe"))
            # Portable NAPS2
            search_paths.append(os.path.join(userprofile, "Desktop", "NAPS2", "NAPS2.Console.exe"))

        # Common drive roots
        for drive in ["C:", "D:"]:
            search_paths.append(os.path.join(drive, "\\NAPS2", "NAPS2.Console.exe"))
            search_paths.append(os.path.join(drive, "\\Program Files", "NAPS2", "NAPS2.Console.exe"))
            search_paths.append(os.path.join(drive, "\\Program Files (x86)", "NAPS2", "NAPS2.Console.exe"))

        for p in search_paths:
            if os.path.isfile(p):
                return p

        # 3. Check if NAPS2.Console is in system PATH
        found = shutil.which("NAPS2.Console") or shutil.which("NAPS2.Console.exe")
        if found:
            return found

        return None

    def _scan_naps2(self, settings, scanner_name=""):
        """Scan using NAPS2 command-line interface - true duplex via TWAIN driver."""
        import subprocess, glob

        naps2_path = settings.get("naps2_path", "")
        naps2_exe = self._find_naps2(custom_path=naps2_path)
        if not naps2_exe:
            raise Exception(
                "NAPS2 no encontrado!\n\n"
                "El escaneo duplex requiere NAPS2 (gratis).\n"
                "1. Descarga de: https://www.naps2.com\n"
                "2. Instalalo\n"
                "3. Configura la ruta en la seccion NAPS2 (DUPLEX)\n\n"
                "O usa 'Feeder (Single side)' para escanear sin NAPS2."
            )

        dpi = settings.get("dpi", 300)
        color = settings.get("color", True)
        source = settings.get("source", "feeder_duplex")
        width_in = settings.get("width_inches", 3.0)
        height_in = settings.get("height_inches", 4.0)
        device_name = settings.get("naps2_device", "").strip()
        profile_name = settings.get("naps2_profile", "").strip()

        # Create temp folder for scan output
        scan_tmp = os.path.join(tempfile.gettempdir(), "flipslab_naps2")
        os.makedirs(scan_tmp, exist_ok=True)

        # Clean previous scans
        for old_file in glob.glob(os.path.join(scan_tmp, "scan_*.png")):
            try:
                os.remove(old_file)
            except:
                pass

        output_path = os.path.join(scan_tmp, "scan_$(n).png")

        # Build NAPS2 command
        cmd = [naps2_exe, "-o", output_path]

        if profile_name:
            # Use a named profile (configured in NAPS2 GUI)
            cmd.extend(["--profile", profile_name])
        else:
            # Build settings from scratch
            cmd.append("--noprofile")
            cmd.extend(["--driver", "twain"])

            naps2_source = "duplex" if source == "feeder_duplex" else "feeder"
            cmd.extend(["--source", naps2_source])
            cmd.extend(["--dpi", str(dpi)])

            bitdepth = "color" if color else "gray"
            cmd.extend(["--bitdepth", bitdepth])

            # Use letter page size so scanner captures full area
            # The auto-crop algorithm will detect and crop to the card
            cmd.extend(["--pagesize", "letter"])

        # CRITICAL: specify device to avoid scanner selection dialog
        if device_name:
            cmd.extend(["--device", device_name])

        cmd.extend(["--split", "-f", "-v"])

        # Show command for debugging
        cmd_str = " ".join(f'"{c}"' if " " in c else c for c in cmd)

        # Run NAPS2 scan
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            raise Exception(
                f"Escaneo timeout (2 minutos).\n\nComando:\n{cmd_str}"
            )
        except FileNotFoundError:
            raise Exception(
                f"NAPS2 no encontrado en:\n{naps2_exe}\n\n"
                "Verifica la ruta en la seccion NAPS2 (DUPLEX)."
            )
        except Exception as e:
            raise Exception(
                f"Error ejecutando NAPS2:\n{e}\n\nComando:\n{cmd_str}"
            )

        # Read output images
        images = []
        scan_files = sorted(glob.glob(os.path.join(scan_tmp, "scan_*.png")))

        for scan_file in scan_files:
            try:
                img = Image.open(scan_file).convert("RGB")
                img = self._auto_crop(img, width_in, height_in, dpi, from_naps2=True)
                images.append(img)
            except Exception:
                pass
            finally:
                try:
                    os.remove(scan_file)
                except:
                    pass

        if not images:
            stdout_msg = result.stdout.strip() if result.stdout else ""
            stderr_msg = result.stderr.strip() if result.stderr else ""
            exit_code = result.returncode

            error_detail = f"NAPS2 no produjo imagenes.\n\n"
            error_detail += f"Exit code: {exit_code}\n"
            if stdout_msg:
                error_detail += f"\nSTDOUT:\n{stdout_msg[:500]}\n"
            if stderr_msg:
                error_detail += f"\nSTDERR:\n{stderr_msg[:500]}\n"
            error_detail += f"\nComando ejecutado:\n{cmd_str}"
            raise Exception(error_detail)

        return images

    def _scan_programmatic(self, device_id, settings):
        """Direct WIA scan - scans ALL pages from feeder in one pass.
        For duplex: front+back of each card. Supports batch (multiple cards).
        
        Key: Set ITEM properties BEFORE device properties (critical for ADF/duplex)."""
        import win32com.client

        dpi = settings.get("dpi", 300)
        color = settings.get("color", True)
        source = settings.get("source", "feeder_duplex")
        width_in = settings.get("width_inches", 3.0)
        height_in = settings.get("height_inches", 4.0)

        device = self._connect_device(device_id)
        if not device:
            raise Exception("Could not connect to scanner device.")

        # --- CRITICAL: Set ITEM properties FIRST (before device props) ---
        item = device.Items(1)
        self._set_prop(item, self.HORIZONTAL_RES, dpi)
        self._set_prop(item, self.VERTICAL_RES, dpi)
        self._set_prop(item, self.COLOR_MODE, 1 if color else 2)

        width_px = int(width_in * dpi)
        height_px = int(height_in * dpi)
        self._set_prop(item, self.HORIZONTAL_START, 0)
        self._set_prop(item, self.VERTICAL_START, 0)
        self._set_prop(item, self.HORIZONTAL_EXTENT, width_px)
        self._set_prop(item, self.VERTICAL_EXTENT, height_px)

        # --- THEN set DEVICE properties ---
        if source == "flatbed":
            self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FLATBED)
            self._set_device_prop(device, self.PAGES, 1)
        elif source == "feeder_duplex":
            self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FEEDER | self.DUPLEX)
            self._set_device_prop(device, self.PAGES, 0)  # 0 = ALL pages
        else:
            self._set_device_prop(device, self.DOC_HANDLING_SELECT, self.FEEDER)
            self._set_device_prop(device, self.PAGES, 0)

        # --- Scan ALL pages from feeder ---
        images = []
        MAX_PAGES = 50

        while len(images) < MAX_PAGES:
            try:
                image_file = item.Transfer(self.WIA_FORMAT_BMP)
                if image_file:
                    tmp = os.path.join(tempfile.gettempdir(),
                                       f"flipslab_{int(time.time() * 1000)}_{len(images)+1}.bmp")
                    image_file.SaveFile(tmp)
                    img = Image.open(tmp).convert("RGB")
                    img = self._auto_crop(img, width_in, height_in, dpi)
                    images.append(img)
                    try:
                        os.remove(tmp)
                    except:
                        pass
                    time.sleep(0.3)  # let scanner prepare next page
                else:
                    break
            except Exception:
                if not images:
                    raise  # first page failed = real error
                break  # feeder empty

        # --- If only 1 page for duplex, try WIA 2.0 sub-items (front/back) ---
        if len(images) == 1 and source == "feeder_duplex":
            try:
                if device.Items.Count > 1:
                    back_item = device.Items(2)
                    self._set_prop(back_item, self.HORIZONTAL_RES, dpi)
                    self._set_prop(back_item, self.VERTICAL_RES, dpi)
                    self._set_prop(back_item, self.COLOR_MODE, 1 if color else 2)
                    back_file = back_item.Transfer(self.WIA_FORMAT_BMP)
                    if back_file:
                        tmp = os.path.join(tempfile.gettempdir(),
                                           f"flipslab_{int(time.time() * 1000)}_back.bmp")
                        back_file.SaveFile(tmp)
                        img2 = Image.open(tmp).convert("RGB")
                        img2 = self._auto_crop(img2, width_in, height_in, dpi)
                        images.append(img2)
                        try:
                            os.remove(tmp)
                        except:
                            pass
            except Exception:
                pass

        # --- Last resort: reconnect to device for back side ---
        if len(images) == 1 and source == "feeder_duplex":
            try:
                time.sleep(0.5)
                device2 = self._connect_device(device_id)
                if device2:
                    item2 = device2.Items(1)
                    back_file = item2.Transfer(self.WIA_FORMAT_BMP)
                    if back_file:
                        tmp = os.path.join(tempfile.gettempdir(),
                                           f"flipslab_{int(time.time() * 1000)}_back2.bmp")
                        back_file.SaveFile(tmp)
                        img3 = Image.open(tmp).convert("RGB")
                        img3 = self._auto_crop(img3, width_in, height_in, dpi)
                        images.append(img3)
                        try:
                            os.remove(tmp)
                        except:
                            pass
            except Exception:
                pass

        if not images:
            raise Exception("Scanner returned no images.")

        return images

    def _scan_with_dialog(self, device_id, settings):
        """Fallback: scan using native WIA dialog, then get remaining pages programmatically."""
        import win32com.client

        dpi = settings.get("dpi", 300)
        color = settings.get("color", True)
        width_in = settings.get("width_inches", 3.0)
        height_in = settings.get("height_inches", 4.0)

        images = []
        dialog = win32com.client.Dispatch("WIA.CommonDialog")
        intent = 1 if color else 2

        # First page via dialog
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

            # Try to get remaining pages by connecting to device directly
            try:
                device = self._connect_device(device_id)
                if device:
                    item = device.Items(1)
                    page_num = 1
                    while page_num < 50:
                        try:
                            img_file = item.Transfer(self.WIA_FORMAT_BMP)
                            if img_file:
                                tmp2 = os.path.join(tempfile.gettempdir(),
                                                    f"flipslab_{int(time.time())}_{page_num+1}.bmp")
                                img_file.SaveFile(tmp2)
                                img2 = Image.open(tmp2).convert("RGB")
                                img2 = self._auto_crop(img2, width_in, height_in, dpi)
                                images.append(img2)
                                try:
                                    os.remove(tmp2)
                                except:
                                    pass
                                page_num += 1
                            else:
                                break
                        except Exception:
                            break
            except Exception:
                pass  # OK, we at least have the first page

        if not images:
            raise Exception("No images returned from scanner.")

        return images

    def _auto_crop(self, img, target_w_in, target_h_in, dpi, from_naps2=False):
        """Post-scan image processing: detect card edges, crop, enhance, add border.
        Uses two-pass variance detection that works regardless of scanner settings.
        from_naps2: if True, skip 180-degree rotation (NAPS2 outputs correct orientation)."""
        import numpy as np
        from PIL import ImageEnhance, ImageOps, ImageFilter

        w, h = img.size
        target_w = int(target_w_in * dpi)
        target_h = int(target_h_in * dpi)

        # For WIA scans: if image is already close to card size, skip detection
        # For NAPS2 scans: ALWAYS run detection (NAPS2 scans full page)
        if not from_naps2 and w <= target_w * 1.3 and h <= target_h * 1.3:
            cropped = img.rotate(180)
        else:
            # Blur to reduce scanner noise
            blurred = img.filter(ImageFilter.GaussianBlur(radius=3))
            gray = np.mean(np.array(blurred, dtype=np.float32), axis=2)

            # === PASS 1: Find card ROWS (row std across full width) ===
            row_stds = np.array([gray[r, :].std() for r in range(gray.shape[0])])
            bg_row_std = np.median(row_stds)
            ROW_THRESH = max(8, bg_row_std * 3)
            content_rows = np.where(row_stds > ROW_THRESH)[0]

            if len(content_rows) == 0:
                # No content detected - use full image
                if from_naps2:
                    cropped = img
                else:
                    cropped = img.rotate(180)
            else:
                r_start = content_rows[0]
                r_end = content_rows[-1] + 1

                # === PASS 2: Find card COLUMNS (within detected rows only) ===
                card_region = gray[r_start:r_end, :]
                col_stds = np.array([card_region[:, c].std() for c in range(card_region.shape[1])])
                bg_col_std = np.median(col_stds)
                COL_THRESH = max(8, bg_col_std * 2)
                content_cols = np.where(col_stds > COL_THRESH)[0]

                if len(content_cols) == 0:
                    # Fallback: use full width of content rows
                    content_cols = np.arange(w)

                # Crop with small margin
                rmin = max(0, content_rows[0] - 5)
                rmax = min(h, content_rows[-1] + 6)
                cmin = max(0, content_cols[0] - 5)
                cmax = min(w, content_cols[-1] + 6)

                cropped = img.crop((cmin, rmin, cmax, rmax))
                # Only rotate for WIA scans (WIA on fi-6130Z outputs upside-down)
                if not from_naps2:
                    cropped = cropped.rotate(180)

        # === ENHANCE COLORS ===
        cropped = ImageOps.autocontrast(cropped, cutoff=0.5)
        cropped = ImageEnhance.Sharpness(cropped).enhance(1.3)
        cropped = ImageEnhance.Color(cropped).enhance(1.15)
        cropped = ImageEnhance.Contrast(cropped).enhance(1.1)
        cropped = ImageEnhance.Brightness(cropped).enhance(1.02)

        # === ADD GRADIENT BORDER (fade from card edge to gray) ===
        border = 25
        BORDER_GRAY = np.array([206, 212, 218], dtype=np.float32)
        arr_c = np.array(cropped, dtype=np.float32)
        ch, cw = arr_c.shape[:2]

        # Sample average edge colors
        top_color = arr_c[0, :, :].mean(axis=0)
        bot_color = arr_c[-1, :, :].mean(axis=0)
        left_color = arr_c[:, 0, :].mean(axis=0)
        right_color = arr_c[:, -1, :].mean(axis=0)

        # Create new image with gray fill
        new_h, new_w = ch + border * 2, cw + border * 2
        result = np.full((new_h, new_w, 3), BORDER_GRAY, dtype=np.float32)

        # Paste card in center
        result[border:border+ch, border:border+cw] = arr_c

        # Gradient fade for each border strip
        for i in range(border):
            t = i / border  # 0 (outer edge) to ~1 (card edge)

            # Top strip
            color = BORDER_GRAY * (1 - t) + top_color * t
            result[i, border:border+cw] = color

            # Bottom strip
            color = BORDER_GRAY * (1 - t) + bot_color * t
            result[new_h - 1 - i, border:border+cw] = color

            # Left strip
            color = BORDER_GRAY * (1 - t) + left_color * t
            result[border:border+ch, i] = color

            # Right strip
            color = BORDER_GRAY * (1 - t) + right_color * t
            result[border:border+ch, new_w - 1 - i] = color

        # Corners: blend between adjacent edge colors
        for i in range(border):
            for j in range(border):
                t_v = i / border
                t_h = j / border
                t = max(t_v, t_h)
                # Top-left
                c = BORDER_GRAY * (1 - t) + ((top_color + left_color) / 2) * t
                result[i, j] = c
                # Top-right
                c = BORDER_GRAY * (1 - t) + ((top_color + right_color) / 2) * t
                result[i, new_w - 1 - j] = c
                # Bottom-left
                c = BORDER_GRAY * (1 - t) + ((bot_color + left_color) / 2) * t
                result[new_h - 1 - i, j] = c
                # Bottom-right
                c = BORDER_GRAY * (1 - t) + ((bot_color + right_color) / 2) * t
                result[new_h - 1 - i, new_w - 1 - j] = c

        cropped = Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))

        return cropped


# ─── Main App ────────────────────────────────────────────
class FlipSlabScanner:
    def __init__(self, root):
        self.root = root
        self.root.title(f"{APP_NAME} v{VERSION}")
        self.root.geometry("960x800")
        self.root.configure(bg=BG)
        self.root.minsize(800, 700)

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

        # Scrollable left panel
        left_canvas = tk.Canvas(left, bg=BG, highlightthickness=0, width=270)
        left_scrollbar = tk.Scrollbar(left, orient="vertical", command=left_canvas.yview)
        self.left_inner = tk.Frame(left_canvas, bg=BG)

        self.left_inner.bind("<Configure>",
            lambda e: left_canvas.configure(scrollregion=left_canvas.bbox("all")))
        left_canvas.create_window((0, 0), window=self.left_inner, anchor="nw", width=270)
        left_canvas.configure(yscrollcommand=left_scrollbar.set)

        left_canvas.pack(side="left", fill="both", expand=True)
        left_scrollbar.pack(side="right", fill="y")

        # Mousewheel scroll
        def _on_mousewheel(event):
            left_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        left_canvas.bind_all("<MouseWheel>", _on_mousewheel)

        self._build_login_section(self.left_inner)
        self._build_scanner_section(self.left_inner)
        self._build_settings_section(self.left_inner)
        self._build_actions_section(self.left_inner)
        self._build_queue_section(self.left_inner)

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

        # ─── NAPS2 Configuration (for duplex scanning) ───
        self._section_title(parent, "NAPS2 (DUPLEX)")

        naps2_frame = tk.Frame(parent, bg=BG3, padx=10, pady=6)
        naps2_frame.pack(fill="x")

        # NAPS2 Path
        tk.Label(naps2_frame, text="NAPS2 Path:", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        path_row = tk.Frame(naps2_frame, bg=BG3)
        path_row.pack(fill="x", pady=(1, 4))
        self.naps2_path_var = tk.StringVar(value=s.get("naps2_path", ""))
        self.naps2_path_entry = tk.Entry(path_row, textvariable=self.naps2_path_var,
                                         font=("Segoe UI", 8), bg=BG, fg=WHITE,
                                         insertbackground=WHITE, relief="flat")
        self.naps2_path_entry.pack(side="left", fill="x", expand=True, ipady=2)
        tk.Button(path_row, text="...", font=("Segoe UI", 8, "bold"),
                  bg=BG, fg=AMBER, relief="flat", cursor="hand2", width=3,
                  command=self._browse_naps2).pack(side="right", padx=(3, 0))

        # Device name
        tk.Label(naps2_frame, text="Device:", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.naps2_device_var = tk.StringVar(value=s.get("naps2_device", "fi-6130dj"))
        tk.Entry(naps2_frame, textvariable=self.naps2_device_var,
                 font=("Segoe UI", 8), bg=BG, fg=WHITE,
                 insertbackground=WHITE, relief="flat").pack(fill="x", ipady=2, pady=(1, 4))

        # Profile name (optional)
        tk.Label(naps2_frame, text="Profile (opcional):", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.naps2_profile_var = tk.StringVar(value=s.get("naps2_profile", ""))
        tk.Entry(naps2_frame, textvariable=self.naps2_profile_var,
                 font=("Segoe UI", 8), bg=BG, fg=WHITE,
                 insertbackground=WHITE, relief="flat").pack(fill="x", ipady=2, pady=(1, 4))

        # Auto-detect NAPS2 button
        tk.Button(naps2_frame, text="Auto-detectar NAPS2", font=("Segoe UI", 8, "bold"),
                  bg=BG, fg=BLUE, relief="flat", cursor="hand2",
                  command=self._auto_detect_naps2).pack(fill="x", ipady=2, pady=(2, 0))

        # NAPS2 status
        self.naps2_status = tk.Label(naps2_frame, text="", font=("Segoe UI", 7),
                                     fg=DARK_GRAY, bg=BG3, wraplength=250, justify="left")
        self.naps2_status.pack(anchor="w", pady=(3, 0))

    def _browse_naps2(self):
        """Browse for NAPS2.Console.exe."""
        path = filedialog.askopenfilename(
            title="Selecciona NAPS2.Console.exe",
            filetypes=[("NAPS2 Console", "NAPS2.Console.exe"), ("All EXE", "*.exe")],
        )
        if path:
            self.naps2_path_var.set(path)
            self.naps2_status.config(text=f"OK: {path}", fg=GREEN)

    def _auto_detect_naps2(self):
        """Try to auto-detect NAPS2 installation."""
        found = self.wia._find_naps2()
        if found:
            self.naps2_path_var.set(found)
            self.naps2_status.config(text=f"Encontrado: {found}", fg=GREEN)
        else:
            self.naps2_status.config(
                text="No encontrado. Usa '...' para buscarlo manualmente.",
                fg=RED
            )

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
                "naps2_path": self.naps2_path_var.get().strip(),
                "naps2_device": self.naps2_device_var.get().strip(),
                "naps2_profile": self.naps2_profile_var.get().strip(),
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

        self.scan_btn = tk.Button(frame, text="SCAN CARDS", font=("Segoe UI", 10, "bold"),
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

        source = self.scan_settings.get("source", "feeder_duplex")
        is_duplex = source == "feeder_duplex"

        self.scan_btn.config(text="Scanning...", state="disabled")
        self.root.update()

        images = []
        error = None
        try:
            hwnd = self.root.winfo_id()
            scanner_name = ""
            idx = self.scanner_combo.current()
            if idx >= 0 and self.scanners:
                scanner_name = self.scanners[idx][1]
            images = self.wia.scan_card(
                self.selected_scanner_id, self.scan_settings,
                window_handle=hwnd, scanner_name=scanner_name
            )
        except Exception as e:
            error = str(e)

        self.scan_btn.config(text="SCAN CARDS", state="normal")

        if error:
            messagebox.showerror("Scan Error", error)
            return

        if not images:
            messagebox.showwarning("No Image", "Scanner didn't return an image.\nIs there a card in the feeder?")
            return

        # Name images: for duplex, alternate front/back per card
        timestamp = int(time.time() * 1000)
        cards_scanned = 0

        if is_duplex:
            # Group in pairs: [front1, back1, front2, back2, ...]
            for i in range(0, len(images), 2):
                cards_scanned += 1
                # Front
                front_name = f"card_{timestamp}_{cards_scanned}_front.png"
                front_path = os.path.join(SCAN_FOLDER, front_name)
                images[i].save(front_path, "PNG")
                self.scanned_images.append({"path": front_path, "name": front_name, "uploaded": False})
                self.queue_listbox.insert(tk.END, f"  {front_name}")

                # Back (if available)
                if i + 1 < len(images):
                    back_name = f"card_{timestamp}_{cards_scanned}_back.png"
                    back_path = os.path.join(SCAN_FOLDER, back_name)
                    images[i + 1].save(back_path, "PNG")
                    self.scanned_images.append({"path": back_path, "name": back_name, "uploaded": False})
                    self.queue_listbox.insert(tk.END, f"  {back_name}")
        else:
            # Single side: each image is a separate card front
            for i, img in enumerate(images):
                cards_scanned += 1
                filename = f"card_{timestamp}_{cards_scanned}_front.png"
                filepath = os.path.join(SCAN_FOLDER, filename)
                img.save(filepath, "PNG")
                self.scanned_images.append({"path": filepath, "name": filename, "uploaded": False})
                self.queue_listbox.insert(tk.END, f"  {filename}")

        self.queue_count.config(text=f"{len(self.scanned_images)} image(s) scanned")
        self._show_preview(self.scanned_images[-1]["path"])
        self._update_buttons()

        if is_duplex:
            msg = f"{cards_scanned} card(s) scanned (front + back)\n{len(images)} total images"
        else:
            msg = f"{cards_scanned} card(s) scanned (front only)\n{len(images)} total images"

        messagebox.showinfo("Scan Complete", f"{msg}\n\nSaved to: {SCAN_FOLDER}")

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
