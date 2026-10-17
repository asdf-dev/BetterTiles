import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {canonicalShortcut, nativeConflicts, NATIVE_SHORTCUT_SCHEMAS} from './shortcuts.js';
import {ACTIONS, LAYOUTS, type Action, type Layout} from './actions.js';
import {copyRect, cycleThird, edgeAt, fitRect, layoutRect, sameRect, transferRect, type Rect} from './geometry.js';
import {WindowState, type Snapshot} from './window-state.js';

interface Drag {
    window: Meta.Window; initial: Snapshot; startX: number; startY: number; restored: boolean;
    candidate: string; since: number; layout?: Layout; monitor: number; cancelled: boolean;
}

export default class BetterTiles extends Extension {
    private settings?: Gio.Settings;
    private nativeSettings?: Gio.Settings;
    private restoreNative = false;
    private previousNativeValue?: GLib.Variant | null;
    private nativeSignal = 0;
    private settingsSignal = 0;
    private signals: [GObjectLike, number][] = [];
    private windows = new Map<Meta.Window, WindowState>();
    private bindings: string[] = [];
    private indicator?: PanelMenu.Button;
    private preview?: St.Widget;
    private drag?: Drag;
    private dragTimer = 0;
    private pending = new Set<number>();
    private active = false;

    enable(): void {
        this.active = true;
        this.settings = this.getSettings();
        this.nativeSettings = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this.nativeSignal = this.nativeSettings.connect('changed::edge-tiling', () => {
            if (this.nativeSettings?.get_boolean('edge-tiling')) this.restoreNative = false;
        });
        this.preview = new St.Widget({style_class: 'better-tiles-preview', reactive: false, visible: false});
        Main.layoutManager.addChrome(this.preview);
        this.listen(global.display, 'grab-op-begin', (_display, window: Meta.Window, op: Meta.GrabOp) => this.beginDrag(window, op));
        this.listen(global.display, 'grab-op-end', () => this.endDrag());
        this.listen(Main.layoutManager, 'monitors-changed', () => {
            this.cancelDrag();
            this.cancelPendingActions();
            this.clearWindows();
        });
        this.listen(Main.overview, 'showing', () => this.cancelDrag());
        this.listen(global.stage, 'captured-event', (_stage, event: Clutter.Event) => {
            if (this.drag && event.type() === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
                this.drag.cancelled = true;
                this.hidePreview();
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this.settingsSignal = this.settings.connect('changed', (_settings, key: string) => {
            if (key === 'hotkeys-enabled' || key.startsWith('shortcut-')) this.bindShortcuts();
            if (key === 'show-indicator' || key.startsWith('shortcut-')) this.buildIndicator();
            if (key === 'snap-enabled') { this.cancelDrag(); this.configureNativeSnapping(); }
            if (key.startsWith('edge-') || key.startsWith('snap-') || key === 'padding') this.cancelDrag();
        });
        for (const schema_id of NATIVE_SHORTCUT_SCHEMAS) {
            const native = new Gio.Settings({schema_id});
            this.listen(native, 'changed', () => this.bindShortcuts());
        }
        this.configureNativeSnapping();
        this.bindShortcuts();
        this.buildIndicator();
    }

    disable(): void {
        this.active = false;
        this.cancelDrag();
        this.cancelPendingActions();
        for (const [object, id] of this.signals) object.disconnect(id);
        this.signals = [];
        for (const name of this.bindings) Main.wm.removeKeybinding(name);
        this.bindings = [];
        this.clearWindows();
        this.indicator?.destroy(); this.indicator = undefined;
        this.preview?.destroy(); this.preview = undefined;
        if (this.settingsSignal) this.settings?.disconnect(this.settingsSignal);
        this.settingsSignal = 0;
        if (this.nativeSignal) this.nativeSettings?.disconnect(this.nativeSignal);
        this.nativeSignal = 0;
        this.releaseNativeSnapping();
        this.settings = undefined;
        this.nativeSettings = undefined;
    }

    private listen(object: GObjectLike, signal: string, handler: (...args: any[]) => any): void {
        this.signals.push([object, object.connect(signal, handler)]);
    }

    private cancelPendingActions(): void {
        for (const id of this.pending) GLib.Source.remove(id);
        this.pending.clear();
    }

    private configureNativeSnapping(): void {
        if (this.settings?.get_boolean('snap-enabled')) {
            if (this.nativeSettings?.get_boolean('edge-tiling')) {
                this.previousNativeValue = this.nativeSettings.get_user_value('edge-tiling');
                this.restoreNative = true;
                this.nativeSettings.set_boolean('edge-tiling', false);
            }
        } else this.releaseNativeSnapping();
    }

    private releaseNativeSnapping(): void {
        if (this.restoreNative && !this.nativeSettings?.get_boolean('edge-tiling')) {
            if (this.previousNativeValue)
                this.nativeSettings?.set_value('edge-tiling', this.previousNativeValue);
            else
                this.nativeSettings?.reset('edge-tiling');
        }
        this.restoreNative = false;
        this.previousNativeValue = undefined;
    }

    private bindShortcuts(): void {
        for (const name of this.bindings) Main.wm.removeKeybinding(name);
        this.bindings = [];
        if (!this.settings?.get_boolean('hotkeys-enabled')) return;
        const occupied = nativeConflicts();
        for (const [action] of ACTIONS) {
            const name = `shortcut-${action}`;
            const accelerators = this.settings.get_strv(name);
            if (!accelerators.length) continue;
            if (accelerators.some(value => occupied.has(canonicalShortcut(value)))) {
                console.warn(`Better Tiles: shortcut for ${action} is already in use; skipping it.`);
                continue;
            }
            for (const value of accelerators) occupied.set(canonicalShortcut(value), action);
            const id = Main.wm.addKeybinding(name, this.settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL,
                () => this.perform(action));
            if (id !== Meta.KeyBindingAction.NONE) this.bindings.push(name);
            else console.warn(`Better Tiles: could not register ${action}; choose a different shortcut in preferences.`);
        }
    }

    private buildIndicator(): void {
        this.indicator?.destroy(); this.indicator = undefined;
        if (!this.settings?.get_boolean('show-indicator')) return;
        const button = new PanelMenu.Button(0.0, 'Better Tiles');
        button.add_child(new St.Icon({icon_name: 'view-grid-symbolic', style_class: 'system-status-icon'}));
        const menu = button.menu as PopupMenu.PopupMenu;
        for (const action of ['center', 'next-monitor', 'previous-monitor'] as const) {
            const label = ACTIONS.find(([id]) => id === action)![1];
            const item = new PopupMenu.PopupMenuItem(label);
            const accelerator = this.settings.get_strv(`shortcut-${action}`)[0] ?? '';
            const shortcut = accelerator.replaceAll('<Control>', 'Ctrl+').replaceAll('<Super>', 'Super+')
                .replaceAll('<Alt>', 'Alt+').replaceAll('<Shift>', 'Shift+');
            item.add_child(new St.Label({text: shortcut, x_expand: true, x_align: Clutter.ActorAlign.END, style_class: 'dim-label'}));
            item.connect('activate', () => this.perform(action));
            menu.addMenuItem(item);
        }
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction('Preferences…', () => this.openPreferences());
        menu.addAction('Quit', () => {
            const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
            shellSettings.set_strv('enabled-extensions',
                shellSettings.get_strv('enabled-extensions').filter(uuid => uuid !== this.uuid));
        });
        Main.panel.addToStatusArea(this.uuid, button);
        this.indicator = button;
    }

    private eligible(window: Meta.Window | null): window is Meta.Window {
        return Boolean(window && window.get_window_type() === Meta.WindowType.NORMAL && !window.is_override_redirect());
    }

    private snapshot(window: Meta.Window): Snapshot {
        return {rect: copyRect(window.get_frame_rect()), monitor: window.get_monitor(),
            maximized: window.is_maximized(), fullscreen: window.is_fullscreen()};
    }

    private state(window: Meta.Window): WindowState {
        let state = this.windows.get(window);
        if (!state) {
            state = new WindowState(window.connect('unmanaged', () => {
                if (this.drag?.window === window) this.cancelDrag();
                this.windows.delete(window);
            }));
            this.windows.set(window, state);
        }
        return state;
    }

    private clearWindows(): void {
        for (const [window, state] of this.windows) window.disconnect(state.unmanaged);
        this.windows.clear();
    }

    private remember(window: Meta.Window, snapshot = this.snapshot(window)): void {
        this.state(window).remember(snapshot, this.snapshot(window));
    }

    private area(window: Meta.Window, monitor = window.get_monitor()): Rect {
        return copyRect(window.get_work_area_for_monitor(monitor));
    }

    private gapFor(layout: Layout): number {
        return layout === 'maximize' && !this.settings!.get_boolean('pad-maximized')
            ? 0 : this.settings!.get_int('padding');
    }

    // Public so the integration harness exercises exactly the same path as shortcuts and the menu.
    perform(action: Action | Layout, window = global.display.focus_window, monitor?: number, before?: Snapshot): void {
        if (!this.active || !this.eligible(window)) return;
        if (action === 'undo') { this.undo(window); return; }
        const destination = monitor ?? window.get_monitor();
        if (destination < 0 || destination >= global.display.get_n_monitors()) return;
        if (!window.allows_move() && !window.is_fullscreen()) return;
        if (action !== 'center' && action !== 'next-monitor' && action !== 'previous-monitor'
            && !window.allows_resize() && !window.is_maximized() && !window.is_fullscreen()) return;
        if (action === 'next-monitor' || action === 'previous-monitor') {
            this.moveMonitor(window, action === 'next-monitor' ? 1 : -1); return;
        }
        const area = this.area(window, destination);
        const padding = this.settings!.get_int('padding');
        const layout = action === 'next-third' || action === 'previous-third'
            ? cycleThird(window.get_frame_rect(), area, action === 'next-third' ? 1 : -1, padding) : action;
        const gap = this.gapFor(layout);
        const rect = layoutRect(layout, area, window.get_frame_rect(), gap);
        if (sameRect(window.get_frame_rect(), rect) && !window.is_fullscreen()
            && (layout !== 'maximize' || window.is_maximized() === (gap === 0))) return;
        this.remember(window, before);
        this.place(window, rect, destination, layout === 'maximize' && gap === 0);
        const state = this.state(window);
        state.target = rect;
        state.layout = layout;
    }

    private place(window: Meta.Window, rect: Rect, monitor: number, maximize = false, fullscreen = false): void {
        if (window.is_fullscreen()) window.unmake_fullscreen();
        window.unmaximize();
        if (window.get_monitor() !== monitor) window.move_to_monitor(monitor);
        window.move_resize_frame(true, rect.x, rect.y, rect.width, rect.height);
        if (maximize) window.maximize();
        if (fullscreen) window.make_fullscreen();
    }

    private undo(window: Meta.Window): void {
        const state = this.windows.get(window);
        const previous = state?.undo();
        if (!previous) return;
        const monitor = Math.min(Math.max(0, previous.monitor), global.display.get_n_monitors() - 1);
        this.place(window, fitRect(previous.rect, this.area(window, monitor)), monitor, previous.maximized, previous.fullscreen);
    }

    private moveMonitor(window: Meta.Window, direction: 1 | -1): void {
        const count = global.display.get_n_monitors();
        if (count < 2) return;
        const current = window.get_monitor(), destination = (current + direction + count) % count;
        const state = this.windows.get(window), before = this.snapshot(window);
        const area = this.area(window, destination);
        const layout = state?.target && sameRect(before.rect, state.target) ? state.layout : undefined;
        const gap = layout ? this.gapFor(layout) : 0;
        const rect = layout ? layoutRect(layout, area, before.rect, gap) : transferRect(before.rect, this.area(window), area);
        this.remember(window, before);
        this.place(window, rect, destination, before.maximized, before.fullscreen);
        const next = this.state(window);
        next.target = layout ? rect : undefined;
        next.layout = layout;
    }

    private beginDrag(window: Meta.Window, op: Meta.GrabOp): void {
        this.cancelDrag();
        this.cancelPendingActions();
        if (!this.settings?.get_boolean('snap-enabled') || (op !== Meta.GrabOp.MOVING && op !== Meta.GrabOp.MOVING_UNCONSTRAINED) || !this.eligible(window)
            || (!window.allows_resize() && !window.is_maximized()) || window.is_fullscreen()) return;
        const [x, y] = global.get_pointer();
        this.drag = {window, initial: this.snapshot(window), startX: x, startY: y, restored: false,
            candidate: '', since: 0, monitor: window.get_monitor(), cancelled: false};
        this.dragTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            this.updateDrag();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private updateDrag(pointer?: [number, number, Clutter.ModifierType]): void {
        const drag = this.drag;
        if (!drag || drag.cancelled) return;
        const [x, y, modifiers] = pointer ?? global.get_pointer();
        const window = drag.window, state = this.windows.get(window);
        if (!drag.restored && Math.hypot(x - drag.startX, y - drag.startY) >= 8) {
            drag.restored = true;
            if (this.settings!.get_boolean('restore-on-drag') && state?.original && state.target
                && sameRect(drag.initial.rect, state.target)) {
                const original = state.original.rect;
                const ratio = Math.max(0, Math.min(1, (drag.startX - drag.initial.rect.x) / drag.initial.rect.width));
                window.unmaximize();
                window.move_resize_frame(true, Math.round(x - original.width * ratio),
                    Math.round(y - Math.min(drag.startY - drag.initial.rect.y, 32)), original.width, original.height);
                state.clearTile();
            }
        }
        const monitor = Main.layoutManager.monitors.find(m => x >= m.x && y >= m.y && x < m.x + m.width && y < m.y + m.height);
        if (!monitor) { this.resetCandidate(); return; }
        const edge = edgeAt(x, y, monitor, this.settings!.get_int('snap-thickness'));
        if (!edge) { this.resetCandidate(); return; }
        let layout = this.settings!.get_string(`edge-${edge}`) as Layout | 'none';
        const modifier = this.settings!.get_string('thirds-modifier');
        const mask = modifier === 'alt' ? Clutter.ModifierType.MOD1_MASK : (Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK);
        if (layout !== 'none' && modifier !== 'none' && (modifiers & mask) && (edge === 'left' || edge === 'right'))
            layout = edge === 'left' ? 'third-left' : 'third-right';
        if (layout === 'none' || !LAYOUTS.some(([id]) => id === layout)) { this.resetCandidate(); return; }
        const candidate = `${monitor.index}:${layout}`;
        if (candidate !== drag.candidate) {
            drag.candidate = candidate; drag.since = GLib.get_monotonic_time(); drag.layout = undefined;
            this.hidePreview();
        }
        if ((GLib.get_monotonic_time() - drag.since) / 1000 < this.settings!.get_int('snap-delay')) return;
        drag.layout = layout; drag.monitor = monitor.index;
        const gap = this.gapFor(layout);
        this.showPreview(layoutRect(layout, this.area(window, monitor.index), window.get_frame_rect(), gap));
    }

    private resetCandidate(): void {
        if (this.drag) { this.drag.candidate = ''; this.drag.layout = undefined; }
        this.hidePreview();
    }

    private showPreview(rect: Rect): void {
        if (!this.preview) return;
        this.preview.set_position(rect.x, rect.y);
        this.preview.set_size(rect.width, rect.height);
        if (this.preview.visible) return;
        this.preview.opacity = 0;
        this.preview.show();
        this.preview.ease({opacity: 255, duration: this.settings!.get_boolean('animations') ? 120 : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD});
    }

    private hidePreview(): void { this.preview?.remove_all_transitions(); this.preview?.hide(); }

    private endDrag(): void {
        if (!this.drag) return;
        // Mutter can end the grab before the stage sees Escape. Only an actual
        // pointer release commits a snap; cancellation and teardown never do.
        const event = Clutter.get_current_event();
        const released = event?.type() === Clutter.EventType.BUTTON_RELEASE;
        if (released) {
            const [x, y] = event.get_coords();
            this.updateDrag([x, y, event.get_state()]);
        }
        const drag = this.drag;
        this.cancelDrag();
        if (!released || !drag.layout || drag.cancelled) return;
        // Apply after Mutter has completed its own grab cleanup.
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.pending.delete(id);
            if (this.active && drag.window.get_compositor_private()) this.perform(drag.layout!, drag.window, drag.monitor, drag.initial);
            return GLib.SOURCE_REMOVE;
        });
        this.pending.add(id);
    }

    private cancelDrag(): void {
        if (this.dragTimer) GLib.Source.remove(this.dragTimer);
        this.dragTimer = 0; this.drag = undefined; this.hidePreview();
    }
}
interface GObjectLike {connect(signal: string, handler: (...args: any[]) => any): number; disconnect(id: number): void}
