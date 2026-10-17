import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import {buildPreferences} from '../dist/preferences.js';
const directory = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_path();
const app = new Adw.Application({application_id: 'local.bettertiles.Preferences', flags: Gio.ApplicationFlags.DEFAULT_FLAGS});
app.connect('activate', () => {
    if (app.active_window) { app.active_window.present(); return; }
    const source = Gio.SettingsSchemaSource.new_from_directory(`${directory}/dist/schemas`, Gio.SettingsSchemaSource.get_default(), false);
    const settings = new Gio.Settings({settings_schema: source.lookup('org.gnome.shell.extensions.better-tiles', false)});
    const window = new Adw.PreferencesWindow({application: app});
    buildPreferences(window, settings, '0.1.0');
    window.present();
});
app.run([]);
