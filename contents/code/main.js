// contents/code/main.js

print("SoloWindow Script: Loading...");

// A set to store the unique IDs of windows that should not be minimized.
const pinnedWindowIds = new Set();

function soloWindow(activeWindow) {
    print(`SoloWindow Script: windowActivated triggered for '${activeWindow ? activeWindow.caption : "N/A"}'.`);

    // --- NEW: If the active window is null (desktop clicked) or not a normal application window (panel, widget, etc.), do nothing. ---
    if (!activeWindow || !activeWindow.normalWindow) {
        print(`SoloWindow Script: Activated window is null or not a normal window. No action will be taken.`);
        return;
    }
    // --- End of new logic ---

    // If the active window is a transient for another window, do nothing.
    if (activeWindow.transientFor) {
        print(`SoloWindow Script: Active window '${activeWindow.caption}' is a transient window. No action will be taken.`);
        activeWindow = activeWindow.transientFor;
    }

    const activeWindowsByOutput = new Map();
    activeWindowsByOutput.set(activeWindow.output, activeWindow);

    const allWindows = workspace.stackingOrder;
    for (let i = allWindows.length - 1; i >= 0; i--) {
        const window = allWindows[i];
        if (!activeWindowsByOutput.has(window.output) && window.normalWindow && !window.minimized) {
            activeWindowsByOutput.set(window.output, window);
        }
    }
    for (const window of allWindows) {
        if (!window.normalWindow || !window.minimizable) {
            continue;
        }
        if (pinnedWindowIds.has(window.internalId)) {
            continue;
        }

        const designatedActiveWindow = activeWindowsByOutput.get(window.output);

        if (window.transientFor && window.transientFor === designatedActiveWindow) {
            continue;
        }

        if (window !== designatedActiveWindow) {
            if (!window.minimized) {
                window.minimized = true;
            }
        }
    }
    print("SoloWindow Script: soloWindow() finished.");
}

function togglePin(window) {
    // Toggles the pinned state for the given window.
    if (!window) return;
    if (pinnedWindowIds.has(window.internalId)) {
        pinnedWindowIds.delete(window.internalId);
        print(`SoloWindow Script: Unpinned window '${window.caption}'.`);
    } else {
        pinnedWindowIds.add(window.internalId);
        print(`SoloWindow Script: Pinned window '${window.caption}'.`);
    }
}

function onWindowRemoved(window) {
    // Cleans up the pinned ID when a window is closed.
    if (pinnedWindowIds.has(window.internalId)) {
        pinnedWindowIds.delete(window.internalId);
        print(`SoloWindow Script: Cleaned up pinned ID for closed window '${window.caption}'.`);
    }
}

// --- Main Connections ---
workspace.windowActivated.connect(soloWindow);
workspace.windowRemoved.connect(onWindowRemoved);
print("SoloWindow Script: Core connections established.");


// --- Final Working Method for Adding the Menu Action ---
registerUserActionsMenu(function(window) {
    // Only show the action for normal windows.
    if (!window.normalWindow) {
        // Return null or undefined if no action should be added for this window.
        return;
    }
    
    // Return a single object. This is the syntax that was confirmed to work.
    return {
        text: "Pin Window (Keep Raised)",
        checkable: true,
        checked: pinnedWindowIds.has(window.internalId),
        triggered: function() {
            // The 'window' object is available here from the outer function's scope.
            togglePin(window);
        }
    };
});
print("SoloWindow Script: Registered final user actions menu.");
