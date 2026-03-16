"""
FlipSlab Scanner Companion v1.1
Uses WIA (Windows Image Acquisition) - works with any scanner on Windows.
No need for TWAIN drivers. Just plug in your scanner and go.
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
VERSION = "1.1.0"
CONFIG_FILE = os.path.join(os.path.expanduser("~"), ".flipslab_scanner.json")
SCAN_FOLDER = os.path.join(os.path.expanduser("~"), "FlipSlab Scans")

# Colors (match FlipSlab dark theme)
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


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def save_config(data):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f)


# ─── WIA Scanner Interface ──────────────────────────────
class WIAScanner:
    """Windows Image Acquisition scanner interface."""

    WIA_DEVICE_TYPE_SCANNER = 1
    WIA_FORMAT_PNG = "{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}"
    WIA_FORMAT_BMP = "{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}"
    WIA_FORMAT_JPEG = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}"

    # WIA property IDs for scanner settings
    WIA_HORIZONTAL_RESOLUTION = 6147
    WIA_VERTICAL_RESOLUTION = 6148
    WIA_COLOR_MODE = 6146  # 0=BW, 1=Grayscale, 2=Color

    def __init__(self):
        self.device_manager = None
        self.selected_device_id = None

    def _get_manager(self):
        import win32com.client
        if not self.device_manager:
            self.device_manager = win32com.client.Dispatch("WIA.DeviceManager")
        return self.device_manager

    def list_scanners(self):
        """Return list of (device_id, device_name) tuples."""
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

    def scan(self, device_id, dpi=300):
        """Scan an image and return PIL Image."""
        import win32com.client
        try:
            # Method 1: Use WIA CommonDialog (most reliable - shows native Windows scan UI)
            try:
                dialog = win32com.client.Dispatch("WIA.CommonDialog")
                image_file = dialog.ShowAcquireImage(
                    self.WIA_DEVICE_TYPE_SCANNER,  # DeviceType = Scanner
                    0,  # Intent = Color
                    0,  # Bias = MinimizeSize
                    self.WIA_FORMAT_BMP,  # FormatID
                    False,  # AlwaysSelectDevice
                    True,  # UseCommonUI
                    False  # CancelError
                )

                if not image_file:
                    return None

                # Save to temp and load with PIL
                tmp = os.path.join(tempfile.gettempdir(), f"flipslab_scan_{int(time.time())}.bmp")
                image_file.SaveFile(tmp)
                img = Image.open(tmp).convert("RGB")
                try:
                    os.remove(tmp)
                except:
                    pass
                return img

            except Exception as e1:
                # Method 2: Direct device access (fallback)
                mgr = self._get_manager()
                device = None
                for i in range(1, mgr.DeviceInfos.Count + 1):
                    info = mgr.DeviceInfos.Item(i)
                    if info.DeviceID == device_id:
                        device = info.Connect()
                        break

                if not device:
                    raise Exception("Scanner not found. Is it still connected?")

                item = device.Items(1)

                # Try to set properties (ignore errors)
                for prop_id, value in [
                    (self.WIA_HORIZONTAL_RESOLUTION, dpi),
                    (self.WIA_VERTICAL_RESOLUTION, dpi),
                    (self.WIA_COLOR_MODE, 2),
                ]:
                    try:
                        item.Properties(prop_id).Value = value
                    except:
                        pass

                image_file = item.Transfer(self.WIA_FORMAT_BMP)
                tmp = os.path.join(tempfile.gettempdir(), f"flipslab_scan_{int(time.time())}.bmp")
                image_file.SaveFile(tmp)
                img = Image.open(tmp).convert("RGB")
                try:
                    os.remove(tmp)
                except:
                    pass
                return img

        except Exception as e:
            raise Exception(f"Scan failed: {e}")


# ─── Main App ────────────────────────────────────────────
class FlipSlabScanner:
    def __init__(self, root):
        self.root = root
        self.root.title(f"{APP_NAME} v{VERSION}")
        self.root.geometry("900x700")
        self.root.configure(bg=BG)
        self.root.minsize(800, 600)

        # State
        self.config = load_config()
        self.server_url = self.config.get("server_url", "https://flipslabengine.com")
        self.session_cookie = None
        self.logged_in = False
        self.scanned_images = []
        self.current_preview = None
        self.scanning = False

        # Scanner
        self.wia = WIAScanner()
        self.scanners = []
        self.selected_scanner_id = None

        os.makedirs(SCAN_FOLDER, exist_ok=True)

        self._build_ui()

    # ─── UI ──────────────────────────────────────────────
    def _build_ui(self):
        # Top bar
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

        # Main content
        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True, padx=15, pady=10)

        # Left panel - Controls
        left = tk.Frame(main, bg=BG, width=280)
        left.pack(side="left", fill="y", padx=(0, 10))
        left.pack_propagate(False)

        self._build_login_section(left)
        self._build_scanner_section(left)
        self._build_actions_section(left)
        self._build_queue_section(left)

        # Right panel - Preview
        right = tk.Frame(main, bg=BG2, relief="flat", bd=1)
        right.pack(side="right", fill="both", expand=True)

        self.preview_label = tk.Label(right, text="Scan a card to preview",
                                      font=("Segoe UI", 11), fg=DARK_GRAY, bg=BG2)
        self.preview_label.pack(expand=True)

    def _section_title(self, parent, text):
        tk.Label(parent, text=text, font=("Segoe UI", 8, "bold"),
                 fg=DARK_GRAY, bg=BG, anchor="w").pack(fill="x", pady=(12, 4))

    def _build_login_section(self, parent):
        self._section_title(parent, "FLIPSLAB ACCOUNT")

        self.login_frame = tk.Frame(parent, bg=BG3, relief="flat")
        self.login_frame.pack(fill="x")

        inner = tk.Frame(self.login_frame, bg=BG3, padx=10, pady=8)
        inner.pack(fill="x")

        tk.Label(inner, text="Server URL", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.url_entry = tk.Entry(inner, font=("Segoe UI", 9), bg=BG, fg=WHITE,
                                  insertbackground=WHITE, relief="flat", bd=0)
        self.url_entry.pack(fill="x", pady=(2, 6), ipady=4)
        self.url_entry.insert(0, self.server_url)

        tk.Label(inner, text="Email", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.email_entry = tk.Entry(inner, font=("Segoe UI", 9), bg=BG, fg=WHITE,
                                    insertbackground=WHITE, relief="flat", bd=0)
        self.email_entry.pack(fill="x", pady=(2, 6), ipady=4)
        self.email_entry.insert(0, self.config.get("email", ""))

        tk.Label(inner, text="Password", font=("Segoe UI", 8), fg=GRAY, bg=BG3).pack(anchor="w")
        self.pass_entry = tk.Entry(inner, font=("Segoe UI", 9), bg=BG, fg=WHITE,
                                   insertbackground=WHITE, relief="flat", bd=0, show="*")
        self.pass_entry.pack(fill="x", pady=(2, 6), ipady=4)

        self.login_btn = tk.Button(inner, text="Connect", font=("Segoe UI", 9, "bold"),
                                   bg=BLUE, fg=WHITE, relief="flat", cursor="hand2",
                                   command=self._login)
        self.login_btn.pack(fill="x", ipady=4, pady=(4, 0))

        # Connected state (hidden initially)
        self.connected_frame = tk.Frame(parent, bg=BG3)
        conn_inner = tk.Frame(self.connected_frame, bg=BG3, padx=10, pady=8)
        conn_inner.pack(fill="x")
        self.connected_label = tk.Label(conn_inner, text="Connected as: ", font=("Segoe UI", 9),
                                        fg=GREEN, bg=BG3)
        self.connected_label.pack(anchor="w")
        tk.Button(conn_inner, text="Disconnect", font=("Segoe UI", 8),
                  bg=BG, fg=RED, relief="flat", cursor="hand2",
                  command=self._logout).pack(fill="x", ipady=2, pady=(4, 0))

    def _build_scanner_section(self, parent):
        self._section_title(parent, "SCANNER")

        frame = tk.Frame(parent, bg=BG3, padx=10, pady=8)
        frame.pack(fill="x")

        self.scanner_combo = ttk.Combobox(frame, state="readonly", font=("Segoe UI", 9))
        self.scanner_combo.pack(fill="x", pady=(0, 6))
        self.scanner_combo.set("Click 'Detect' to find scanners")

        btn_row = tk.Frame(frame, bg=BG3)
        btn_row.pack(fill="x")

        self.detect_btn = tk.Button(btn_row, text="Detect Scanners", font=("Segoe UI", 8, "bold"),
                                    bg=BG, fg=AMBER, relief="flat", cursor="hand2",
                                    command=self._detect_scanners)
        self.detect_btn.pack(side="left", expand=True, fill="x", padx=(0, 3), ipady=3)

        self.select_btn = tk.Button(btn_row, text="Select", font=("Segoe UI", 8, "bold"),
                                    bg=BG, fg=BLUE, relief="flat", cursor="hand2",
                                    command=self._select_scanner)
        self.select_btn.pack(side="right", expand=True, fill="x", padx=(3, 0), ipady=3)

        self.scanner_status = tk.Label(frame, text="No scanner selected", font=("Segoe UI", 8),
                                       fg=DARK_GRAY, bg=BG3)
        self.scanner_status.pack(anchor="w", pady=(4, 0))

    def _build_actions_section(self, parent):
        self._section_title(parent, "ACTIONS")

        frame = tk.Frame(parent, bg=BG)
        frame.pack(fill="x")

        self.scan_btn = tk.Button(frame, text="SCAN CARD", font=("Segoe UI", 11, "bold"),
                                  bg=GREEN, fg=WHITE, relief="flat", cursor="hand2",
                                  command=self._scan_card, state="disabled")
        self.scan_btn.pack(fill="x", ipady=8, pady=(0, 4))

        btn_row = tk.Frame(frame, bg=BG)
        btn_row.pack(fill="x")

        self.upload_btn = tk.Button(btn_row, text="Upload to FlipSlab", font=("Segoe UI", 9, "bold"),
                                    bg=BLUE, fg=WHITE, relief="flat", cursor="hand2",
                                    command=self._upload_all, state="disabled")
        self.upload_btn.pack(side="left", expand=True, fill="x", padx=(0, 3), ipady=5)

        self.clear_btn = tk.Button(btn_row, text="Clear All", font=("Segoe UI", 9),
                                   bg=BG3, fg=GRAY, relief="flat", cursor="hand2",
                                   command=self._clear_all)
        self.clear_btn.pack(side="right", ipady=5, ipadx=10)

        # Import from folder
        self.import_btn = tk.Button(frame, text="Import from folder...", font=("Segoe UI", 8),
                                    bg=BG3, fg=GRAY, relief="flat", cursor="hand2",
                                    command=self._import_folder)
        self.import_btn.pack(fill="x", ipady=3, pady=(4, 0))

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
                                     json={"email": email, "password": password},
                                     timeout=10)
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
        self.connected_label.config(text=f"Connected as: {name}")
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
            scanners = []
            error = None
            try:
                scanners = self.wia.list_scanners()
            except Exception as e:
                error = str(e)
            self.root.after(0, lambda: self._on_detect_done(scanners, error))

        threading.Thread(target=do_detect, daemon=True).start()

    def _on_detect_done(self, scanners, error):
        self.detect_btn.config(text="Detect Scanners", state="normal")

        if error:
            messagebox.showerror("Scanner Error", f"Error detecting scanners:\n{error}")
            return

        if not scanners:
            self.scanner_combo.set("No scanners found")
            messagebox.showinfo("No Scanners",
                "No scanners detected.\n\n"
                "Make sure:\n"
                "1. Scanner is connected via USB\n"
                "2. Scanner is turned ON\n"
                "3. Scanner drivers are installed")
            return

        self.scanners = scanners
        names = [name for _, name in scanners]
        self.scanner_combo["values"] = names
        self.scanner_combo.current(0)
        self.scanner_status.config(text=f"{len(scanners)} scanner(s) found", fg=AMBER)

    def _select_scanner(self):
        idx = self.scanner_combo.current()
        if idx < 0 or not self.scanners:
            messagebox.showwarning("Select Scanner", "Please detect and select a scanner first.")
            return

        self.selected_scanner_id = self.scanners[idx][0]
        name = self.scanners[idx][1]
        self.scanner_status.config(text=f"Ready: {name}", fg=GREEN)
        self._update_buttons()

    # ─── Scan ────────────────────────────────────────────
    def _scan_card(self):
        if not self.selected_scanner_id:
            messagebox.showwarning("No Scanner", "Please select a scanner first.")
            return

        self.scanning = True
        self.scan_btn.config(text="Scanning...", state="disabled")
        self.root.update()

        def do_scan():
            image = None
            error = None
            try:
                image = self.wia.scan(self.selected_scanner_id, dpi=300)
            except Exception as e:
                error = str(e)
            self.root.after(0, lambda: self._on_scan_done(image, error))

        threading.Thread(target=do_scan, daemon=True).start()

    def _on_scan_done(self, image, error):
        self.scanning = False
        self.scan_btn.config(text="SCAN CARD", state="normal")

        if error:
            messagebox.showerror("Scan Error", f"Scan failed:\n{error}")
            return

        if not image:
            messagebox.showwarning("No Image", "Scanner did not return an image.")
            return

        # Save to file
        timestamp = int(time.time() * 1000)
        filename = f"card_{timestamp}.png"
        filepath = os.path.join(SCAN_FOLDER, filename)

        try:
            image.save(filepath, "PNG")
        except Exception as e:
            messagebox.showerror("Save Error", f"Could not save image:\n{e}")
            return

        self.scanned_images.append({"path": filepath, "name": filename, "uploaded": False})
        self.queue_listbox.insert(tk.END, f"  {filename}")
        self.queue_count.config(text=f"{len(self.scanned_images)} card(s) scanned")
        self._show_preview(filepath)
        self._update_buttons()

    # ─── Import from folder ──────────────────────────────
    def _import_folder(self):
        folder = filedialog.askdirectory(title="Select folder with scanned card images")
        if not folder:
            return

        count = 0
        for f in sorted(os.listdir(folder)):
            ext = f.lower().split(".")[-1]
            if ext in ("png", "jpg", "jpeg", "bmp", "tiff", "tif"):
                filepath = os.path.join(folder, f)
                self.scanned_images.append({"path": filepath, "name": f, "uploaded": False})
                self.queue_listbox.insert(tk.END, f"  {f}")
                count += 1

        if count > 0:
            self.queue_count.config(text=f"{len(self.scanned_images)} card(s) scanned")
            self._show_preview(self.scanned_images[-1]["path"])
            self._update_buttons()
            messagebox.showinfo("Imported", f"{count} images imported!")
        else:
            messagebox.showinfo("No Images", "No image files found in selected folder.")

    # ─── Preview ─────────────────────────────────────────
    def _show_preview(self, filepath):
        try:
            img = Image.open(filepath)
            preview_w = self.preview_label.winfo_width() or 550
            preview_h = self.preview_label.winfo_height() or 550
            img.thumbnail((preview_w - 20, preview_h - 20), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            self.preview_label.config(image=photo, text="")
            self.preview_label.image = photo
            self.current_preview = filepath
        except Exception as e:
            self.preview_label.config(text=f"Preview error: {e}", image="")

    def _on_queue_select(self, event):
        sel = self.queue_listbox.curselection()
        if sel and sel[0] < len(self.scanned_images):
            self._show_preview(self.scanned_images[sel[0]]["path"])

    # ─── Upload ──────────────────────────────────────────
    def _upload_all(self):
        if not self.logged_in:
            messagebox.showwarning("Not Connected", "Please connect to FlipSlab first.")
            return

        pending = [img for img in self.scanned_images if not img["uploaded"]]
        if not pending:
            messagebox.showinfo("Nothing to Upload", "All cards have been uploaded already.")
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
                        files = {"file": (img["name"], f, "image/png")}
                        cookies = {"session_token": self.session_cookie} if self.session_cookie else {}
                        resp = requests.post(
                            f"{self.server_url}/api/cards/scan-upload",
                            files=files,
                            cookies=cookies,
                            timeout=60,
                        )

                    if resp.status_code == 200:
                        img["uploaded"] = True
                        success += 1
                        idx = self.scanned_images.index(img)
                        self.root.after(0, lambda idx=idx, name=img["name"]:
                            self._mark_uploaded(idx, name))
                except Exception as e:
                    print(f"Upload error for {img['name']}: {e}")

            self.root.after(0, lambda: self._on_upload_done(success, len(pending)))

        threading.Thread(target=do_upload, daemon=True).start()

    def _mark_uploaded(self, idx, name):
        self.queue_listbox.delete(idx)
        self.queue_listbox.insert(idx, f"  {name}  [UPLOADED]")
        self.queue_listbox.itemconfig(idx, fg=GREEN)

    def _on_upload_done(self, success, total):
        self.upload_btn.config(text="Upload to FlipSlab", state="normal")
        messagebox.showinfo("Upload Complete", f"{success}/{total} cards uploaded to FlipSlab!\n\nThe AI will identify each card automatically.")
        self._update_buttons()

    # ─── Clear ───────────────────────────────────────────
    def _clear_all(self):
        if self.scanned_images and not messagebox.askyesno("Clear All", "Remove all scanned cards from queue?"):
            return
        self.scanned_images.clear()
        self.queue_listbox.delete(0, tk.END)
        self.queue_count.config(text="0 cards scanned")
        self.preview_label.config(text="Scan a card to preview", image="")
        self.preview_label.image = None
        self._update_buttons()

    # ─── Helpers ─────────────────────────────────────────
    def _update_buttons(self):
        has_scanner = self.selected_scanner_id is not None
        has_images = any(not img["uploaded"] for img in self.scanned_images)
        self.scan_btn.config(state="normal" if has_scanner else "disabled")
        self.upload_btn.config(state="normal" if (self.logged_in and has_images) else "disabled")


# ─── Main ────────────────────────────────────────────────
if __name__ == "__main__":
    root = tk.Tk()
    style = ttk.Style()
    style.theme_use("clam")
    style.configure("TCombobox",
                    fieldbackground=BG, background=BG3, foreground=WHITE,
                    selectbackground=BLUE, borderwidth=0)
    app = FlipSlabScanner(root)
    root.mainloop()
