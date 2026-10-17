import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
const root=GLib.getenv('BETTER_TILES_TEST_ROOT');
const {buildPreferences}=await import(`file://${root}/dist/preferences.js`);
const app=new Adw.Application({application_id:'local.bettertiles.PreferencesTest',flags:Gio.ApplicationFlags.NON_UNIQUE});
app.connect('activate',()=>{
    const source=Gio.SettingsSchemaSource.new_from_directory(`${root}/dist/schemas`,Gio.SettingsSchemaSource.get_default(),false);
    const settings=new Gio.Settings({settings_schema:source.lookup('org.gnome.shell.extensions.better-tiles',false)});
    const window=new Adw.PreferencesWindow({application:app});
    buildPreferences(window,settings,'0.1.0'); window.present();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT,100,()=>{
        const file=Gio.File.new_for_path(`${root}/.test-session/preferences-page`);
        if(file.query_exists(null)){const [,bytes]=file.load_contents(null); window.set_visible_page_name(new TextDecoder().decode(bytes));}
        return GLib.SOURCE_CONTINUE;
    });
    GLib.timeout_add(GLib.PRIORITY_DEFAULT,400,()=>{GLib.file_set_contents(`${root}/.test-session/preferences-ok`,'ok'); return GLib.SOURCE_REMOVE;});
});
app.run([]);
