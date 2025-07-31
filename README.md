# Solo Window - A Focus-Mode KWin Script for KDE Plasma 6

![Solo Window Demo](demo.gif)

**Solo Window** is a powerful KWin script for KDE Plasma 6 designed to bring ultimate focus to your workflow. It automatically minimizes all windows except the one you are currently working on, creating a clean, distraction-free environment on each of your monitors.

---

### Why You Need This

In a modern desktop environment, it's easy to get overwhelmed by window clutter. Multiple applications, browsers, and terminals can quickly lead to a disorganized workspace, making it difficult to concentrate on the task at hand.

Solo Window solves this problem by implementing a "single-window focus mode." By keeping only the active window (and its dialogs) visible, it helps you:

-   **Enhance Focus:** Eliminate visual noise and concentrate fully on one application at a time.
-   **Boost Productivity:** Spend less time managing windows and more time doing meaningful work.
-   **Maintain a Clean Desktop:** Enjoy a minimalist and organized workspace without constantly needing to manually minimize windows.

If you've ever wanted to force a "one-task-at-a-time" policy on your desktop, this script is for you.

---

### Features

-   **Automatic Minimization:** When you switch to a window, all other windows on that same monitor are automatically minimized.
-   **Ideal for Multi-Monitor & Ultrawide Setups:** Each monitor maintains its own "solo window." On large ultrawide screens, you can enable a mode to keep non-overlapping windows visible, making perfect use of your screen real estate.
-   **Virtual Desktop Aware:** The script respects your virtual desktops, only minimizing windows that share the same desktop as your active one.
-   **Intelligent Dialog Handling:** The script is smart enough to keep a parent window visible when you open one of its dialogs (e.g., a "File Open" or "Settings" window).
-   **Pinning for Exceptions:** Need to keep a few windows visible? Simply "pin" them using the window menu, and they will be excluded from the auto-minimize rule.
-   **Plasma Integration:** Adds a "Pin Window" option directly to the window's right-click menu for easy access.
-   **Highly Configurable:** Fine-tune the script's behavior from the settings dialog. You can toggle multi-monitor mode, virtual desktop awareness, non-overlapping window mode, and more.
-   **Intelligent Restoration:** When you close a window, the script automatically restores any windows that were minimized because of it, seamlessly returning you to your previous context.

---

### Installation (KDE Plasma 6)

1.  **Download the Script:**
    Clone this repository or download the source code as a ZIP file.
    ```bash
    git clone [https://github.com/aario/kwin-solo-window.git](https://github.com/aario/kwin-solo-window.git)
    ```

2.  **Navigate to the Directory:**
    Open a terminal and `cd` into the downloaded script's directory.
    ```bash
    cd kwin-solo-window
    ```

3.  **Install using KPackageTool:**
    Use the official KDE packaging tool to install the script. The `.` tells it to install from the current directory.
    ```bash
    kpackagetool6 --type KWin/Script -i .
    ```

4.  **Enable the Script:**
    -   Go to **System Settings** -> **Window Management** -> **KWin Scripts**.
    -   Find **"Solo Window"** in the list and check the box to enable it.
    -   Click **Apply**.

The script is now active!

---

### How to Use

-   **Automatic Mode:** Simply click on any window to make it active. All other windows on that monitor will minimize.
-   **Pinning a Window:** To prevent a window from being minimized, right-click its title bar, go to **More Actions**, and select **Pin Window (Keep Raised)**. A checkmark will appear next to it. To unpin it, simply click the option again.
-   **Configuring the Script:** In **System Settings** -> **Window Management** -> **KWin Scripts**, click the **Configure** (gear) icon next to "Solo Window" to open its settings. Here you can tailor the script's behavior to perfectly match your workflow.

---

### Support This Project

If you find this script useful and it helps improve your workflow, please consider supporting its development. Your contribution helps me dedicate more time to creating and maintaining open-source projects like this one.

<a href="https://github.com/sponsors/aario" target="_blank">
  <img src="https://img.shields.io/badge/Sponsor_on_GitHub-❤-db61a2.svg?style=for-the-badge" alt="Sponsor on GitHub">
</a>

---

*Keywords: KDE Plasma 6, KWin Script, window management, focus mode, single window, minimize all, productivity, tiling, distraction-free, Linux desktop, custom script.*
