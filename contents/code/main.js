// contents/code/main.js

print("SoloWindow Script: Loading...");

// A set to store the unique IDs of windows that should not be minimized.
const pinnedWindowIds = new Set();
const config = {
    respectMonitors: readConfig('respectMonitors', true),
    respectVirtualDesktops: readConfig('respectVirtualDesktops', true),
    respectOverlap: readConfig('respectOverlap', true),
    pinnedWindowsDontMinimize: readConfig('pinnedWindowsDontMinimize', true)
};

function soloWindow(activeWindow) {
    print(`SoloWindow Script: windowActivated triggered for '${activeWindow ? activeWindow.caption : "N/A"}'.`);

    if (!activeWindow
        || !activeWindow.normalWindow
        || (config.pinnedWindowsDontMinimize && pinnedWindowIds.has(activeWindow.internalId))) {
        print(`SoloWindow Script: Activated window is null or not a normal window, or is pinned. Skipping.`);
        return;
    }

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
        const designatedActiveWindow = config.respectMonitors
            ? activeWindowsByOutput.get(window.output) // One active window per each monitor
            : activeWindow; // Only one active window for all monitors

        if (!window.normalWindow
            || !window.minimizable
            || pinnedWindowIds.has(window.internalId)
            || window === designatedActiveWindow
            || window.minimized
            || (window.transientFor
                && window.transientFor === designatedActiveWindow)
            || (config.respectVirtualDesktops && !areOnSameVirtualDesktop(designatedActiveWindow, window))
            || (config.respectOverlap && !doWindowsOverlap(designatedActiveWindow, window))) {
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
