import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
const root = GLib.getenv('BETTER_TILES_TEST_ROOT');
const fixed = ARGV[0] === 'fixed';
const app = new Adw.Application({application_id: 'local.bettertiles.Test', flags: Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate', () => {
    const win = new Gtk.ApplicationWindow({application: app, title: fixed ? 'Better Tiles Fixed Window' : 'Better Tiles Test Window', default_width: 600, default_height: 400, resizable: !fixed});
    win.set_titlebar(new Gtk.HeaderBar());
    win.set_child(new Gtk.Label({label: 'Better Tiles integration test'})); win.present();
});
app.run([]);
