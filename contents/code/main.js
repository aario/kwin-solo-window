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
        const designatedActiveWindow = activeWindowsByOutput.get(window.output);

        if (!window.normalWindow
            || !window.minimizable
            || pinnedWindowIds.has(window.internalId)
            || window === designatedActiveWindow
            || window.minimized
            || (window.transientFor
                && window.transientFor === activeWindowsByOutput.get(window.output))
            || !areOnSameVirtualDesktop(designatedActiveWindow, window)) {
            continue;
        }

        window.minimized = true;
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

/**
 * Compares two window objects to determine if they share a virtual desktop.
 *
 * @param {object} activeWindow The current active KWin window object.
 * @param {object} otherWindow The second KWin window object for which we decode to minimize or not.
 * @returns {boolean} Returns true if the windows share at least one virtual
 * desktop or if either window is set to be on all desktops.
 * Otherwise, returns false.
 */
function areOnSameVirtualDesktop(activeWindow, otherWindow) {
    // If either window is set to be on all desktops, they are considered
    // to be sharing a desktop space.
    if (otherWindow.onAllDesktops) {
        return true;
    }

    // Create a Set of desktop IDs for the first window for efficient lookup.
    const desktopsA_ids = new Set(activeWindow.desktops.map(d => d.id));

    // Iterate through the desktops of the second window. If we find any
    // desktop ID that exists in the first window's set, they overlap.
    for (const desktopB of otherWindow.desktops) {
        if (desktopsA_ids.has(desktopB.id)) {
            return true; // Found a common desktop.
        }
    }

    // If the loop completes without finding a match, they are on different desktops.
    return false;
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
