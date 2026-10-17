# Better Tiles

Better Tiles arranges application windows in GNOME Shell 51 on Wayland. Use keyboard shortcuts, drag a window to a screen edge, or choose an action from a small panel menu. It is inspired by Tiles, but is currently a local development build rather than a feature-for-feature replacement.

## What it does

- Tile windows into halves, quarters, thirds, or two-thirds of the usable screen area.
- Center or maximize a window, move it between displays, and undo the last 20 actions for each window.
- Preview a layout when you drag a window to an edge. Dragging a tiled window can restore its earlier floating size.
- Set padding, edge actions, snap timing, a thirds modifier, and individual shortcuts in native GTK4/libadwaita preferences.
- Leave GNOME's existing shortcut bindings in place: Better Tiles skips its own shortcut when it detects a conflict.

## Requirements

This source build targets **GNOME Shell 51 on Wayland**. Building it requires Node.js and npm, GJS, and GLib's `glib-compile-schemas`. The preferences UI uses GTK4 and libadwaita. The extension metadata advertises GNOME Shell 51 only.

There is no packaged release or extensions.gnome.org listing yet. Installation is currently from source using the development extension ID `better-tiles@local`.

## Install from source

From the project directory, run:

```sh
npm ci
npm run install:local
```

The installer builds the extension and copies it to `~/.local/share/gnome-shell/extensions/better-tiles@local` or the equivalent path under `XDG_DATA_HOME`. It does not enable the extension. Log out and back in if GNOME has not discovered it, then enable **Better Tiles** in the Extensions app or run:

```sh
gnome-extensions enable better-tiles@local
```

Open its settings from the Extensions app or with:

```sh
gnome-extensions prefs better-tiles@local
```

You can preview the preferences before installing with `npm run prefs`. After installing a new build on Wayland, log out and back in to load the replacement code.

If you use another tiling extension, disable its edge snapping to avoid competing drag behavior. While Better Tiles snapping is enabled, it temporarily turns off GNOME's built-in edge tiling and restores it when Better Tiles is disabled.

## Use Better Tiles

### Drag to an edge

Drag a normal application window to an edge and wait for the preview, then release to snap it. Corners select quarters, the left and right edges select halves, and the top edge maximizes. The bottom edge has no default action. Hold **Alt** at a left or right edge to choose a third; you can change or disable that modifier in preferences. Move away from the edge or press Escape to cancel a preview.

### Keyboard shortcuts

The default shortcuts start with **Super+Control+Alt**. Add the key shown below:

| Key | Action |
| --- | --- |
| Left / Right / Up / Down | Left / right / top / bottom half |
| C / F | Center / maximize |
| U / I / J / K | Upper left / upper right / lower left / lower right quarter |
| Period / Comma | Next / previous third |
| Shift+Left / Shift+Up / Shift+Right | Left / center / right two-thirds |
| Page Down / Page Up | Next / previous display |
| Z | Undo |

All 18 shortcuts can be changed or cleared on the **Hotkeys** preferences page. A conflicting GNOME shortcut is shown there and is not registered by Better Tiles.

### Panel menu and preferences

The panel menu offers **Center**, **Next Display**, **Previous Display**, **Preferences**, and **Quit**. Quit disables Better Tiles until you enable it again. You can hide the panel menu in preferences; settings remain available in the Extensions app.

The **General** page controls the menu, preview animation, and padding. **Hotkeys** records and resets shortcuts. **Snap to Edges** controls the eight edge actions, snap zone thickness, activation delay, thirds modifier, and restore-on-drag behavior.

## Behavior and limits

- Layouts use each monitor's work area, leaving room for the GNOME top bar. Coordinates and padding are logical pixels.
- Ordinary maximize enters GNOME's maximized state. With **Apply padding when maximizing**, Better Tiles sizes an ordinary window within the work area instead.
- Moving a tiled window to another display keeps its layout. Moving a floating window preserves its size where the destination has room.
- Undo stores up to 20 actions per window, including its monitor and fullscreen or maximized state. History clears when displays change or the extension is disabled.
- Fixed-size windows can be centered or moved between displays; actions that require resizing are skipped. Applications still control their minimum window size.
- Other extensions and application shortcuts can still conflict with Better Tiles and may need manual adjustment.

To stop using the extension, disable it in the Extensions app or run `gnome-extensions disable better-tiles@local`. The local installer does not manage removal; after disabling, remove its directory from your user GNOME extensions folder if you want to uninstall it.

## Development and contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, bug reports, and pull requests, and [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries and lifecycle details.

```sh
npm run typecheck
npm test
npm run test:gnome
```

The GNOME integration test runs an isolated headless Shell with private D-Bus and two virtual monitors. It does not change your current desktop's extension state. It needs a host that allows local D-Bus sockets. Test artifacts are written to `.test-session/` and replaced on the next run.

Current manual coverage gaps include fractional scaling, physical display removal, non-US keyboard layouts, and coexistence with other tiling extensions. The [development plan](plan.md) has the broader acceptance checklist.

Before a public release, the project needs a license, a public extension ID, and a distribution process. The source currently uses `better-tiles@local` and includes no update downloader.
