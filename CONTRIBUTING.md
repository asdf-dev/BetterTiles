# Contributing to Better Tiles

Thanks for helping improve Better Tiles. Bug reports, documentation fixes, tests, and code changes are welcome.

## Before you start

Read the [architecture guide](ARCHITECTURE.md) for the module boundaries and lifecycle rules. For a larger behavior change, open an issue first so the expected behavior can be discussed before you spend time implementing it. Small fixes can go straight to a pull request.

When reporting a bug, include your GNOME Shell version, whether the session uses Wayland or X11, steps to reproduce it, the expected and actual behavior, and any relevant Shell log messages. Mention active tiling extensions if the issue involves snapping or shortcuts.

## Local setup

Development targets GNOME Shell 51. You need Node.js and npm, TypeScript dependencies from `npm ci`, GJS, and `glib-compile-schemas`. To try the extension locally, you also need a GNOME 51 session.

```sh
npm ci
npm run typecheck
npm test
```

`npm run install:local` builds and copies the extension to your user extension directory. It does not enable it. See the [README](README.md) for the enable and preferences commands. On Wayland, log out and back in after replacing an already loaded extension.

## Making a change

- Keep rectangle calculations in `src/geometry.ts` and per-window undo and restore rules in `src/window-state.ts`. Keep GNOME Shell objects, signals, and UI lifecycle in `src/extension.ts`.
- Pair each new signal, timer, keybinding, or actor with cleanup in `disable()`. Clear references to a window when it becomes unmanaged.
- If you add an action, layout, or edge option, update `src/actions.ts`, the relevant behavior, and the GSettings schema together. Update preferences and documentation when users can see the change.
- Add a focused test for changed geometry or history behavior. For Shell behavior, extend the integration harness when it can verify the behavior reliably.
- Keep pull requests focused and explain the user-visible change, the checks you ran, and any GNOME behavior you could not test.

## Validation

```sh
npm run typecheck
npm test
npm run test:gnome
```

The GNOME integration test starts a private headless Shell, D-Bus session, settings store, and two virtual monitors. It requires a host that permits local D-Bus sockets and headless GNOME Shell. If you cannot run it, say so in your pull request and include the error. For changes to dragging, monitor handling, or preferences, also test in a GNOME 51 session when available and describe what you checked.
