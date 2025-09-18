// contents/code/main.js

const DEBUG = false;
const DEBUG_MAX_SWEEP_FUNCTION_CALLS = 1000;
var debug_sweep_function_calls = 0;

function log(logMessage) {
    if (!DEBUG) {
        return;
    }

    //No other solution for printing logs worked! None whatsoever.
    console.error(`SoloWindow: ${logMessage}`);
}

log("Loading script...");

// A set to store the unique IDs of windows that should not be minimized.
const pinnedWindowIds = new Set();
const manuallyMinimizedWindowIds = new Set();

// A map to store the script's intent to change a window's minimized state.
// Key: window.internalId, Value: boolean (true for minimize, false for restore)
const scriptChangeIntents = new Map();

// Read configuration from the settings UI.
const config = {
    respectMonitors: readConfig('respectMonitors', true),
    respectVirtualDesktops: readConfig('respectVirtualDesktops', true),
    respectOverlap: readConfig('respectOverlap', true),
    pinnedWindowsDontMinimize: readConfig('pinnedWindowsDontMinimize', true)
};

function isNormalAndMinimizable(window) {
    return window.normalWindow
        && window.minimizable;
}

function shouldCheckMinimizeRules(window) {
    return isOnCurrentVirtualDesktop(window)
        && isNormalAndMinimizable(window)
        && !pinnedWindowIds.has(window.internalId)
        && !manuallyMinimizedWindowIds.has(window.internalId);
}

/**
 * Determines if a given window (A) should be minimized by checking if any other
 * window (B) is "dominant" over it based on a set of rules.
 * @param {object} windowA The window to evaluate.
 * @param {object[]} allWindows A list of all current windows in stacking order.
 * @returns {boolean} True if the window should be minimized, false otherwise.
 */
function shouldBeMinimized(windowA, allWindows) {
    log(`shouldBeMinimized '${windowA.caption}'`);
    // A window cannot be minimized if it's not a normal, minimizable window,
    // or if it is explicitly pinned by the user.
    if (!shouldCheckMinimizeRules(windowA)) {
        log(`We don't care. Skipping.`);
        return false;
    }

    // Loop through all other windows to see if any of them should cause windowA to be minimized.
    for (const windowB of allWindows) {
        log(`Checking against '${windowB.caption}'...`);
        // The "causer" window (B) must be a normal window.
        if (!windowB.normalWindow) {
            log(`Not a normal window. Skipping.`);
            continue;
        }

        if (manuallyMinimizedWindowIds.has(windowB.internalId)) {
            log(`This one has been manually minimized. We skip it`);
            continue;
        }

        // Condition: Respect multiple displays setting.
        if (config.respectMonitors && windowA.output !== windowB.output) {
            log(`Is on another monitor. Skipping.`);
            continue;
        }

        // Condition: Respect multiple virtual desktops setting.
        if (config.respectVirtualDesktops && !areOnSameVirtualDesktop(windowA, windowB)) {
            log(`Is on another virtual desktop. Skipping.`);
            continue;
        }

        // A window cannot minimize itself or its own parent/child dialogs.
        if (windowA === windowB || getAncestorForTransientWindow(windowA) === windowB || getAncestorForTransientWindow(windowB) === windowA) {
            log(`Same or related. Skipping.`);
            continue;
        }

        // Condition: Window B must have a higher Z-order (be on top of Window A).
        // In KWin's stackingOrder, a lower index means a higher position.
        if (allWindows.indexOf(windowB) < allWindows.indexOf(windowA)) {
            log(`Is under '${windowA.caption}'. Skipping.`);
            continue;
        }

        // Condition: Check if pinning prevents minimization.
        if (config.pinnedWindowsDontMinimize && pinnedWindowIds.has(windowB.internalId)) {
            log(`Is a pinned window. Skipping.`);
            continue;
        }

        // Condition: Respect overlap setting.
        if (config.respectOverlap && !doWindowsOverlap(windowA, windowB)) {
            log(`Does not overlap. Skipping.`);
            continue;
        }

        // If we've reached this point, it means windowB meets all criteria to
        // make windowA minimize. We can stop checking and return true.
        log(`'${windowA.caption}' should be minimized because of '${windowB.caption}'.`);
        return true;
    }

    // If the loop completes, no window was found that should minimize windowA.
    return false;
}

/**
 * The main function that evaluates and applies the state for all windows.
 * It uses a two-pass system:
 * 1. First Pass: Determine the desired state (minimized/restored) for every window.
 * 2. Second Pass: Apply the determined states.
 * This prevents a change in one window from affecting the calculation for another in the same sweep.
 */
function sweepWindows() {
	if (DEBUG) {
	 	if (debug_sweep_function_calls >= DEBUG_MAX_SWEEP_FUNCTION_CALLS) {
			log('DEBUG MODE - Max sweep function calls reached. Skip to prevent frozen dekstop. Reload the script to continue testing.');
			return;
		}

		debug_sweep_function_calls = debug_sweep_function_calls + 1;
	}

    log("sweepWindows() triggered.");
    const allWindows = workspace.stackingOrder;
    const desiredStates = new Map();
    const ancerstorsToKeepUp = new Set();

    // --- Pass 1: Determine all states ---
    for (const window of allWindows) {
        windowShouldBeMinimized = shouldBeMinimized(window, allWindows);
        desiredStates.set(window.internalId, windowShouldBeMinimized);

        if (config.respectOverlap) {
            continue;
        }

        // We are in true solo-window mode
        ancestor = getAncestorForTransientWindow(window)
        if (ancestor == window) { //This is not a transient window
            if (ancerstorsToKeepUp.has(ancestor.internalId)) {
                windowShouldBeMinimized = false;
                desiredStates.set(ancestor.internalId, windowShouldBeMinimized); 
                log(`A child transient window of '${ancestor.caption}' is decided to be up. The ancestor follows`);
            }
        } else { // It is a transient window with an ancestor
            if (!windowShouldBeMinimized // Current window has been decided to show up
            && !manuallyMinimizedWindowIds.has(ancestor.internalId) // Ancestor has not been manually minimized
            ) { 
                desiredStates.set(ancestor.internalId, windowShouldBeMinimized); // Ancestor follows transient
                ancerstorsToKeepUp.add(ancestor.internalId);
                log(`Window '${window.caption}' is a transient child window. The ancestor '${ancestor.caption}' follows it`);
            }
        }
    }

    // --- Pass 2: Apply all states ---
    for (const window of allWindows) {
        const shouldBeMinimized = desiredStates.get(window.internalId);
        if (shouldBeMinimized === undefined) continue;

        if (shouldBeMinimized && !window.minimized) {
            log(`Record our intent to MINIMIZE '${window.caption}'`);
            scriptChangeIntents.set(window.internalId, true);
            window.minimized = true;
        } else if (!shouldBeMinimized
            && window.minimized
            && !manuallyMinimizedWindowIds.has(window.internalId)) {
            log(`Record our intent to RESTORE '${window.caption}'`);
            scriptChangeIntents.set(window.internalId, false);
            window.minimized = false;
        }
    }

    log("sweepWindows() finished.");
}


/**
 * Toggles the pinned state for a given window.
 * @param {object} window The window to pin or unpin.
 */
function togglePin(window) {
    if (!window) return;

    if (pinnedWindowIds.has(window.internalId)) {
        pinnedWindowIds.delete(window.internalId);
        log(`Unpinned window '${window.caption}'.`);
    } else {
        pinnedWindowIds.add(window.internalId);
        log(`Pinned window '${window.caption}'.`);
    }
    // A change in pinning requires a re-evaluation of the window states.
    sweepWindows();
}

function getAncestorForTransientWindow(window) {
    const parent = window.transientFor;
    return parent ? getAncestorForTransientWindow(parent) : window;
}

function isOnCurrentVirtualDesktop(window) {
    const windowDesktops = new Set(window.desktops.map(d => d.id));

    return windowDesktops.has(workspace.currentDesktop.id)
}

function areOnSameVirtualDesktop(windowA, windowB) {
    if (windowA.onAllDesktops || windowB.onAllDesktops) {
        return true;
    }
    const desktopsA = new Set(windowA.desktops.map(d => d.id));
    for (const desktopB of windowB.desktops) {
        if (desktopsA.has(desktopB.id)) {
            return true;
        }
    }
    return false;
}

function doWindowsOverlap(windowA, windowB) {
    const rectA = windowA.clientGeometry;
    const rectB = windowB.clientGeometry;
    if (rectA.right < rectB.left || rectA.left > rectB.right) return false;
    if (rectA.bottom < rectB.top || rectA.top > rectB.bottom) return false;
    return true;
}


function onWindowRemoved(window) {
    if (!isNormalAndMinimizable(window)) {
        return;
    }

    // Clean up the pinned ID for the closed window.
    pinnedWindowIds.delete(window.internalId);
    manuallyMinimizedWindowIds.delete(window.internalId)
    log(`Cleaned up pinned ID for closed window '${window.caption}'.`);

    sweepWindows();
}

function onMinimizedChanged(window) {
    const intent = scriptChangeIntents.get(window.internalId);

    // Check if the script intended to change this window's state.
    if (intent !== undefined) {
        // A script action was intended.
        // `intent` is true if we wanted to minimize, false if we wanted to restore.
        // `window.minimized` is the window's current state.

        if (window.minimized === intent) {
            // The state now matches our intent, so the action is complete.
            // We can now remove the intent flag.
            log(`Script action for '${window.caption}' complete. Cleaning up.`);
            scriptChangeIntents.delete(window.internalId);
        } else {
            // The state does not yet match our intent.
            // This is the "before" signal that fires with the old state. We ignore it.
            log(`Ignoring 'before' signal for script action on '${window.caption}'.`);
        }
        return; // It was a script action, so our work is done.
    }

    // If we reach here, there was no script intent. This was a manual user action.
    log(`Processing manual minimize change for '${window.caption}'.`);
    if (window.minimized) {
        manuallyMinimizedWindowIds.add(window.internalId);
        log(`Marked as manually minimized.`);
    } else {
        manuallyMinimizedWindowIds.delete(window.internalId);
        log(`Unmarked as manually minimized.`);
    }
    
    // A manual change requires re-evaluating all window states.
    sweepWindows();
}

// --- Signal Connections ---

// Connect signals for newly created windows.
function onWindowAdded(window) {
    if (!isNormalAndMinimizable(window)) {
        return;
    }

    log('onWindowAdded called');
    // Any change to a window's geometry, state, or location should trigger a sweep.
    window.interactiveMoveResizeFinished.connect(() => {
        log(`interactiveMoveResizeFinished on '${window.caption}'`);
        sweepWindows()
    });
    window.minimizedChanged.connect(function() {
        onMinimizedChanged(window);
    });
    window.outputChanged.connect(() => {
        log(`outputChanged on '${window.caption}'`);
        sweepWindows()
    });
    window.desktopsChanged.connect(() => {
        log(`desktopsChanged on '${window.caption}'`);
        sweepWindows()
    });
}

// Connect signals that affect the entire workspace.
workspace.windowAdded.connect(onWindowAdded);
workspace.windowRemoved.connect(onWindowRemoved);
// workspace.windowActivated.connect((window) => {
//     log(`windowActivated triggered.`);
//     sweepWindows()
// });
workspace.currentDesktopChanged.connect((window) => {
    log(`windowActivated on '${window.caption}'`);
    currentDesktopChanged()
});

// Connect signals for all windows that already exist when the script loads.
for (const window of workspace.stackingOrder) {
    onWindowAdded(window);
}

log("Core connections established.");

// --- Register the right-click menu action for pinning ---
registerUserActionsMenu(function(window) {
    if (!window.normalWindow) {
        return;
    }
    return {
        text: "Pin Window (Solo Window)",
        checkable: true,
        checked: pinnedWindowIds.has(window.internalId),
        triggered: () => togglePin(window)
    };
});
log("Registered user actions menu.");
