import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {canonicalShortcut, nativeConflicts} from './shortcuts.js';
import {ACTIONS, EDGES, LAYOUTS, type Action} from './actions.js';

export function buildPreferences(window: Adw.PreferencesWindow, settings: Gio.Settings, version: string): void {
    window.set_title('Better Tiles');
    window.set_default_size(820, 720);
    window.set_search_enabled(true);
    const subscriptions: number[] = [];
    const watch = (key: string, callback: () => void) => subscriptions.push(settings.connect(`changed::${key}`, callback));
    window.connect('close-request', () => { for (const id of subscriptions) settings.disconnect(id); subscriptions.length = 0; return false; });
    const page = (title: string, icon: string) => {
        const value = new Adw.PreferencesPage({title, name: title.toLowerCase().replaceAll(' ', '-'), icon_name: icon}); window.add(value); return value;
    };
    const group = (parent: Adw.PreferencesPage, title: string, description = '') => {
        const value = new Adw.PreferencesGroup({title, description}); parent.add(value); return value;
    };
    const toggle = (parent: Adw.PreferencesGroup, key: string, title: string, subtitle = '') => {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT); parent.add(row); return row;
    };
    const spin = (parent: Adw.PreferencesGroup, key: string, title: string, subtitle: string, upper: number, step = 1, lower = 0) => {
        const row = new Adw.SpinRow({title, subtitle, adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 5})});
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT); parent.add(row);
    };

    const general = page('General', 'preferences-system-symbolic');
    const appearance = group(general, 'Make room for your windows', 'Arrange windows with shortcuts, the panel menu, or a drag to the screen edge.');
    toggle(appearance, 'show-indicator', 'Show panel menu', 'Keep window actions and preferences within reach.');
    toggle(appearance, 'animations', 'Animate snap previews', 'Follow GNOME’s animation settings.');
    const spacing = group(general, 'Window spacing');
    spin(spacing, 'padding', 'Padding', 'Logical pixels around windows and between adjacent tiles.', 64);
    toggle(spacing, 'pad-maximized', 'Apply padding when maximizing', 'Fill the work area with padding instead of entering the maximized state.');
    const integration = group(general, 'GNOME integration');
    integration.add(new Adw.ActionRow({title: 'Starts with GNOME', subtitle: 'Manage whether Better Tiles is enabled in the Extensions app.'}));
    integration.add(new Adw.ActionRow({title: 'Use one snapping extension', subtitle: 'Disable edge snapping in other tiling extensions before using Better Tiles. GNOME’s built-in edge snapping is restored when Better Tiles is disabled.'}));

    const hotkeys = page('Hotkeys', 'input-keyboard-symbolic');
    const hotkeyOptions = group(hotkeys, 'Keyboard control', 'Choose a shortcut to record a new combination. Backspace clears it; Escape cancels.');
    toggle(hotkeyOptions, 'hotkeys-enabled', 'Enable hotkeys');
    const shortcutGroup = group(hotkeys, 'Window actions');
    for (const [action, title] of ACTIONS) {
        const row = new Adw.ActionRow({title, activatable: true});
        const label = new Gtk.ShortcutLabel({disabled_text: 'Not set', valign: Gtk.Align.CENTER});
        const button = new Gtk.Button({child: label, valign: Gtk.Align.CENTER, tooltip_text: `Change ${title} shortcut`});
        const refresh = () => {
            const accelerator = settings.get_strv(`shortcut-${action}`)[0] ?? '';
            label.set_accelerator(accelerator);
            const conflict = accelerator ? findConflict(settings, action, accelerator) : null;
            row.set_subtitle(conflict ? `Conflict: ${conflict}. Choose another shortcut.` : '');
        };
        refresh(); watch(`shortcut-${action}`, refresh);
        button.connect('clicked', () => recordShortcut(window, settings, action, title));
        row.add_suffix(button); row.set_activatable_widget(button); shortcutGroup.add(row);
        settings.bind('hotkeys-enabled', row, 'sensitive', Gio.SettingsBindFlags.GET);
    }
    const defaults = group(hotkeys, 'Defaults');
    const reset = new Gtk.Button({label: 'Restore Default Shortcuts', halign: Gtk.Align.START, css_classes: ['destructive-action']});
    reset.connect('clicked', () => {
        const dialog = new Adw.AlertDialog({heading: 'Restore default shortcuts?', body: 'Your custom shortcuts will be replaced.'});
        dialog.add_response('cancel', 'Cancel'); dialog.add_response('restore', 'Restore');
        dialog.set_response_appearance('restore', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_default_response('cancel'); dialog.set_close_response('cancel');
        dialog.connect('response', (_dialog, response: string) => {
            if (response === 'restore') for (const [action] of ACTIONS) settings.reset(`shortcut-${action}`);
        });
        dialog.present(window);
    });
    defaults.add(reset);

    const snapping = page('Snap to Edges', 'view-grid-symbolic');
    const behavior = group(snapping, 'Drag to arrange');
    toggle(behavior, 'snap-enabled', 'Snap to screen edges', 'Release inside an active edge zone to arrange the window.');
    toggle(behavior, 'restore-on-drag', 'Restore size when dragging', 'Return a tiled window to its previous size when you move it.');
    spin(behavior, 'snap-thickness', 'Snap zone thickness', 'Logical pixels from the physical monitor edge.', 64, 1, 1);
    spin(behavior, 'snap-delay', 'Activation delay', 'Milliseconds to wait before showing the snap preview.', 1000, 25);
    const modifier = new Adw.ComboRow({title: 'Hold to snap to thirds', subtitle: 'Overrides left and right edge actions while dragging.',
        model: Gtk.StringList.new(['Disabled', 'Alt', 'Super'])});
    const modifierValues = ['none', 'alt', 'super'];
    modifier.set_selected(modifierValues.indexOf(settings.get_string('thirds-modifier')));
    modifier.connect('notify::selected', () => settings.set_string('thirds-modifier', modifierValues[modifier.selected]!));
    watch('thirds-modifier', () => modifier.set_selected(modifierValues.indexOf(settings.get_string('thirds-modifier'))));
    behavior.add(modifier);
    const edges = group(snapping, 'Active edges', 'Choose what happens at each edge and corner of a display.');
    const grid = new Gtk.Grid({column_spacing: 12, row_spacing: 18, column_homogeneous: true, margin_top: 12, margin_bottom: 12});
    const positions = [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]];
    EDGES.forEach(([id, title], index) => {
        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6});
        box.append(new Gtk.Label({label: title, xalign: 0, css_classes: ['caption', 'dim-label']}));
        const select = new Gtk.DropDown({model: Gtk.StringList.new(LAYOUTS.map(([, label]) => label)), tooltip_text: `${title} edge action`});
        select.set_selected(LAYOUTS.findIndex(([layout]) => layout === settings.get_string(`edge-${id}`)));
        select.connect('notify::selected', () => settings.set_string(`edge-${id}`, LAYOUTS[select.selected]![0]));
        watch(`edge-${id}`, () => select.set_selected(LAYOUTS.findIndex(([layout]) => layout === settings.get_string(`edge-${id}`))));
        box.append(select); grid.attach(box, positions[index]![0]!, positions[index]![1]!, 1, 1);
    });
    const screen = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6, valign: Gtk.Align.CENTER});
    screen.append(new Gtk.Image({icon_name: 'video-display-symbolic', pixel_size: 40}));
    screen.append(new Gtk.Label({label: 'Your display', css_classes: ['dim-label', 'caption']}));
    grid.attach(screen, 1, 1, 1, 1); edges.add(grid);
    settings.bind('snap-enabled', edges, 'sensitive', Gio.SettingsBindFlags.GET);

    const about = page('About', 'help-about-symbolic');
    const identity = group(about, '');
    const hero = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12, margin_top: 24, margin_bottom: 24});
    hero.append(new Gtk.Image({icon_name: 'view-grid-symbolic', pixel_size: 72}));
    hero.append(new Gtk.Label({label: 'Better Tiles', css_classes: ['title-1']}));
    hero.append(new Gtk.Label({label: `Version ${version}`, css_classes: ['dim-label']}));
    hero.append(new Gtk.Label({label: 'A little order. A lot more room.', css_classes: ['title-4']}));
    identity.add(hero);
    const details = group(about, 'Made for GNOME');
    details.add(new Adw.ActionRow({title: 'Window behavior', subtitle: 'Maximize keeps the top bar visible. Undo remembers up to 20 actions per window; history resets when displays change or the extension is disabled.'}));
}

function recordShortcut(parent: Adw.PreferencesWindow, settings: Gio.Settings, action: Action, title: string): void {
    const dialog = new Adw.Window({title: `Shortcut for ${title}`, transient_for: parent, modal: true, default_width: 440, default_height: 270, resizable: false});
    const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 18, margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24});
    box.append(new Gtk.Label({label: `Set shortcut for ${title}`, css_classes: ['title-2']}));
    box.append(new Gtk.Label({label: 'Press a key combination\nEscape to cancel · Backspace to clear', justify: Gtk.Justification.CENTER}));
    const error = new Gtk.Label({wrap: true, css_classes: ['error']}); box.append(error);
    const cancel = new Gtk.Button({label: 'Cancel', halign: Gtk.Align.CENTER}); cancel.connect('clicked', () => dialog.close()); box.append(cancel);
    dialog.set_content(box);
    const controller = new Gtk.EventControllerKey();
    controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
    controller.connect('key-pressed', (_controller, keyval: number, _keycode: number, state: Gdk.ModifierType) => {
        if (keyval === Gdk.KEY_Escape) { dialog.close(); return true; }
        if (keyval === Gdk.KEY_BackSpace) { settings.set_strv(`shortcut-${action}`, []); dialog.close(); return true; }
        let modifiers = state & Gtk.accelerator_get_default_mod_mask();
        modifiers &= ~Gdk.ModifierType.LOCK_MASK;
        const lower = Gdk.keyval_to_lower(keyval);
        if (lower !== keyval) modifiers |= Gdk.ModifierType.SHIFT_MASK;
        if (!Gtk.accelerator_valid(lower, modifiers) || !(modifiers & (Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.ALT_MASK | Gdk.ModifierType.SUPER_MASK))) {
            error.set_label('Use Control, Alt, or Super together with a key.'); return true;
        }
        const accelerator = Gtk.accelerator_name(lower, modifiers);
        const conflict = findConflict(settings, action, accelerator);
        if (conflict) { error.set_label(`Already used by ${conflict}. Choose another combination.`); return true; }
        settings.set_strv(`shortcut-${action}`, [accelerator]); dialog.close(); return true;
    });
    dialog.add_controller(controller); dialog.present();
}

function findConflict(settings: Gio.Settings, action: Action, accelerator: string): string | null {
    const normalized = canonicalShortcut(accelerator);
    for (const [id, label] of ACTIONS)
        if (id !== action && settings.get_strv(`shortcut-${id}`).some(value => canonicalShortcut(value) === normalized)) return label;
    return nativeConflicts().get(normalized) ?? null;
}
