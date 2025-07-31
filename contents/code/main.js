// contents/code/main.js

print("minimizedOtherWindows function: Loading...");

// A set to store the unique IDs of windows that should not be minimized.
const pinnedWindowIds = new Set();
const causerVictimMap = new Map();
const justMinimizedById = new Set();
const config = {
    respectMonitors: readConfig('respectMonitors', true),
    respectVirtualDesktops: readConfig('respectVirtualDesktops', true),
    respectOverlap: readConfig('respectOverlap', true),
    pinnedWindowsDontMinimize: readConfig('pinnedWindowsDontMinimize', true)
};

function minimizedOtherWindows(activeWindow) {
    print(`minimizedOtherWindows function: windowActivated triggered for '${activeWindow ? activeWindow.caption : "N/A"}'.`);

    if (!activeWindow
        || !activeWindow.normalWindow
        || (config.pinnedWindowsDontMinimize && pinnedWindowIds.has(activeWindow.internalId))) {
        print(`minimizedOtherWindows function: Activated window is null or not a normal window, or is pinned. Skipping.`);
        return;
    }

    // If the active window is a transient for another window, do nothing.
    if (activeWindow.transientFor) {
        print(`minimizedOtherWindows function: Active window '${activeWindow.caption}' is a transient window. Will consider its main parent.`);
        activeWindow = getAncestorForTransientWindow(activeWindow);
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
        const designatedActiveWindow = config.respectMonitors
            ? activeWindowsByOutput.get(window.output) // One active window per each monitor
            : activeWindow; // Only one active window for all monitors

        if (!window.normalWindow
            || !window.minimizable
            || pinnedWindowIds.has(window.internalId)
            || window === designatedActiveWindow
            || window.minimized
            || (getAncestorForTransientWindow(window) === designatedActiveWindow)
            || (config.respectVirtualDesktops && !areOnSameVirtualDesktop(designatedActiveWindow, window))
            || (config.respectOverlap && !doWindowsOverlap(designatedActiveWindow, window))) {
            continue;
        }

        // --- Record the causer-victim relationship ---
        const causer = designatedActiveWindow;
        if (causer) { // Ensure we have a valid causer
            if (!causerVictimMap.has(causer.internalId)) {
                causerVictimMap.set(causer.internalId, new Set());
            }
            causerVictimMap.get(causer.internalId).add(window.internalId);
            print(`minimizedOtherWindows function: Recorded '${causer.caption}' as causer for victim '${window.caption}'.`);
        }

        // --- NEW: Add the window to our temporary ignore list ---
        justMinimizedById.add(window.internalId);

        window.minimized = true;
    }
    print("minimizedOtherWindows function: minimizedOtherWindows() finished.");
}

function togglePin(window) {
    // Toggles the pinned state for the given window.
    if (!window) return;
    if (pinnedWindowIds.has(window.internalId)) {
        pinnedWindowIds.delete(window.internalId);
        print(`minimizedOtherWindows function: Unpinned window '${window.caption}'.`);
    } else {
        pinnedWindowIds.add(window.internalId);
        print(`minimizedOtherWindows function: Pinned window '${window.caption}'.`);
    }
}

function onWindowRemoved(window) {
    const closedWindowId = window.internalId;

    // First, clean up the pinned window list as before.
    if (pinnedWindowIds.has(window.internalId)) {
        pinnedWindowIds.delete(window.internalId);
        print(`minimizedOtherWindows function: Cleaned up pinned ID for closed window '${window.caption}'.`);
    }

    // Part A: Check if the closed window was a "causer". If so, restore its victims.
    print(`minimizedOtherWindows function: Causer window '${window.caption}' closed. Restoring victim(s).`);
    restoreVictims(closedWindowId)

    // Part B: Clean up any "orphaned" victims.
    // This removes the closed window from any other causer's victim list.
    for (const victimSet of causerVictimMap.values()) {
        victimSet.delete(closedWindowId);
    }
}

function restoreVictims(causerWindowId) {
    // --- Restore victims and clean up the map ---
    if (!causerVictimMap.has(causerWindowId)) {
        return;
    }

    const victimIds = causerVictimMap.get(causerWindowId);
    const allWindows = workspace.stackingOrder;

    for (const victimId of victimIds) {
        // Find the actual window object for this victim ID.
        const victimWindow = allWindows.find(win => win.internalId === victimId);
        if (victimWindow && victimWindow.minimized) {
            print(`minimizedOtherWindows function: Restoring victim '${victimWindow.caption}'.`);
            victimWindow.minimized = false;
        }
    }
    // Remove the entry for the closed causer.
    causerVictimMap.delete(causerWindowId);
}

function onWindowMinimizedChanged(window) {
    // This function is called whenever a window's minimized state changes.
    // We only care if the window is BEING minimized by the user.
    if (!window.minimized) {
        return;
    }

    // --- Check if this minimization was caused by our script ---
    if (justMinimizedById.has(window.internalId)) {
        // This was a script-triggered minimization.
        // Remove it from the ignore list and do nothing else.
        justMinimizedById.delete(window.internalId);
        return;
    }

    print(`minimizedOtherWindows function: Window '${window.caption}' was minimized. Restoring its victims.`);
    restoreVictims(window.internalId)
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

/**
 * Checks if two window objects physically overlap on the screen.
 *
 * @param {object} windowA The first KWin window object.
 * @param {object} windowB The second KWin window object.
 * @returns {boolean} Returns true if the windows' geometries intersect,
 * otherwise returns false.
 */
function doWindowsOverlap(windowA, windowB) {
    // The KWin::Window object provides a 'geometry' property, which is a
    // QRectF object. The QRectF object itself doesn't have an 'intersects'
    // method directly exposed in the scripting API, but we can manually
    // check for intersection by comparing the coordinates.

    const rectA = windowA.clientGeometry;
    const rectB = windowB.clientGeometry;

    // Check if the rectangles do NOT overlap. It's often easier to prove
    // a negative. Two rectangles do not overlap if one is entirely to the
    // left, right, top, or bottom of the other.

    if (rectA.right < rectB.left || rectA.left > rectB.right) {
        return false; // They are horizontally separate.
    }

    if (rectA.bottom < rectB.top || rectA.top > rectB.bottom) {
        return false; // They are vertically separate.
    }

    // If they are not separate either horizontally or vertically,
    // they must overlap.
    return true;
}

function getAncestorForTransientWindow(window) {
    const parent = window.transientFor
    if (!parent) {
        return window
    }

    return getAncestorForTransientWindow(parent)
}

function reevaluateVictims(window) {
    const victimIds = causerVictimMap.get(window.internalId);
    if (!victimIds) {
        return;
    }

    print(`minimizedOtherWindows function: Causer window '${window.caption}' moved. Checking victim(s) to restore.`);

    const allWindows = workspace.stackingOrder;
    for (const victimId of victimIds) {
        // Find the actual window object for this victim ID.
        const victimWindow = allWindows.find(win => win.internalId === victimId);
        if (victimWindow
            && victimWindow.minimized
            && config.respectOverlap
            && !doWindowsOverlap(window, victimWindow)) {
            print(`minimizedOtherWindows function: Restoring victim '${victimWindow.caption}'.`);
            victimWindow.minimized = false;
            // Remove the entry for the restored victim.
            victimIds.delete(victimWindow);
        }
    }
}

// --- Main Connections ---
workspace.windowActivated.connect(minimizedOtherWindows);
workspace.windowRemoved.connect(onWindowRemoved);
// This function will run for every new window that is created.
function onWindowAdded(window) {
    // Connect to the minimizedChanged signal for this specific window.
    window.minimizedChanged.connect(function() {
        onWindowMinimizedChanged(window);
    });

    // --- Connect to signals for movement, desktop, and screen changes ---
    window.interactiveMoveResizeFinished.connect(function() {
        reevaluateVictims(window);
        minimizedOtherWindows(window)
    });
}

// Connect the handler for new windows.
workspace.windowAdded.connect(onWindowAdded);
// And also connect it for all windows that already exist when the script loads.
for (const window of workspace.stackingOrder) {
    onWindowAdded(window);
}

print("minimizedOtherWindows function: Core connections established.");


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
print("minimizedOtherWindows function: Registered final user actions menu.");
