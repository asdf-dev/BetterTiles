import Gio from 'gi://Gio';
export const NATIVE_SHORTCUT_SCHEMAS = ['org.gnome.desktop.wm.keybindings', 'org.gnome.mutter.keybindings', 'org.gnome.shell.keybindings'];
// GSettings accelerators permit aliases and arbitrary modifier order.
export function canonicalShortcut(value: string): string {
    const aliases: Record<string, string> = {ctrl: 'control', primary: 'control', mod1: 'alt', meta: 'super'};
    const modifiers = [...value.matchAll(/<([^>]+)>/g)].map(match => {
        const modifier = match[1]!.toLowerCase(); return aliases[modifier] ?? modifier;
    });
    return `${[...new Set(modifiers)].sort().join('+')}:${value.replace(/<[^>]+>/g, '').toLowerCase()}`;
}
export function nativeConflicts(): Map<string, string> {
    const result = new Map<string, string>();
    const source = Gio.SettingsSchemaSource.get_default();
    for (const id of NATIVE_SHORTCUT_SCHEMAS) {
        const schema = source?.lookup(id, true);
        if (!schema) continue;
        const settings = new Gio.Settings({settings_schema: schema});
        for (const key of schema.list_keys()) {
            if (settings.get_value(key).get_type_string() !== 'as') continue;
            for (const binding of settings.get_strv(key)) if (binding) result.set(canonicalShortcut(binding), `GNOME (${key})`);
        }
    }
    return result;
}
