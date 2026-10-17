import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
const pause = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {resolve(); return GLib.SOURCE_REMOVE;}));
const rect = w => {const r=w.get_frame_rect(); return {x:r.x,y:r.y,width:r.width,height:r.height};};
function check(value, message) {if (!value) throw new Error(message);}
function near(actual, expected, message) {
    check(Object.keys(expected).every(k=>Math.abs(actual[k]-expected[k])<=2), `${message}: ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
}
export default class Harness extends Extension {
    enable() {this.start = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1800, () => {this.start=0; this.run(); return GLib.SOURCE_REMOVE;});}
    disable() {if(this.start) GLib.Source.remove(this.start); this.process?.force_exit();}
    async run() {
        const root=GLib.getenv('BETTER_TILES_TEST_ROOT'), uuid=GLib.getenv('BETTER_TILES_UUID'), passed=[];
        try {
            Main.overview.hide();
            const target=Main.extensionManager.lookup(uuid);
            check(target?.stateObj, `Extension failed to load: ${JSON.stringify(target?.errors)}`);
            const ext=target.stateObj;
            const geometry=await import(`file://${root}/dist/geometry.js`);
            const actions=await import(`file://${root}/dist/actions.js`);
            check(global.display.get_n_monitors()===2,'Need two virtual monitors');
            check(!new Gio.Settings({schema_id:'org.gnome.mutter'}).get_boolean('edge-tiling'),'Native snapping not disabled');
            passed.push('Extension loads on GNOME 51; takes ownership of built-in snapping');
            const menuItems=()=>ext.indicator.menu._getMenuItems().map(item=>item.label?.text).filter(Boolean);
            check(JSON.stringify(menuItems())===JSON.stringify(['Center','Next Display','Previous Display','Preferences…']),`Unexpected panel menu: ${menuItems()}`);
            passed.push('Panel menu contains the window actions and preferences');
            this.process=Gio.Subprocess.new(['gjs','-m',`${root}/tests/test-window.js`], Gio.SubprocessFlags.NONE);
            let window;
            for(let i=0;i<40;i++){await pause(100); window=global.get_window_actors().map(a=>a.meta_window).find(w=>w.get_title()==='Better Tiles Test Window'); if(window && window.get_frame_rect().width > 100)break;}
            check(window && window.get_frame_rect().width > 100,'Test window did not map');
            window.activate(global.get_current_time()); await pause(400);
            const initial=rect(window), monitor=window.get_monitor();
            const area=window.get_work_area_for_monitor(monitor);
            for(const [layout] of actions.LAYOUTS){
                if(layout==='none'||layout==='center'||layout==='maximize')continue;
                ext.perform(layout,window); await pause(100);
                near(rect(window),geometry.layoutRect(layout,area,initial),layout);
            }
            passed.push('Real Wayland window: halves, quarters, thirds, two-thirds');
            ext.perform('center',window); await pause(100);
            const centered=rect(window); check(Math.abs(centered.x-area.x-(area.width-centered.width)/2)<=2,'Center failed');
            ext.perform('maximize',window); await pause(150); check(window.is_maximized(),'Maximize failed');
            ext.perform('half-left',window); await pause(250); check(!window.is_maximized(),'Unmaximize failed');
            ext.perform('undo',window); await pause(150); check(window.is_maximized(),'Undo did not restore maximization');
            passed.push('Center, maximize, unmaximize, undo restore window state');
            ext.perform('half-left',window); await pause(100);
            ext.perform('next-monitor',window); await pause(200);
            check(window.get_monitor()!==monitor,'Monitor transfer failed');
            near(rect(window),geometry.layoutRect('half-left',window.get_work_area_for_monitor(window.get_monitor()),initial),'Monitor layout preservation');
            ext.perform('undo',window); await pause(150); check(window.get_monitor()===monitor,'Monitor undo failed');
            passed.push('Monitor transfer between unequal resolutions and undo');
            ext.settings.set_int('padding',12); await pause(100);
            ext.perform('half-right',window); await pause(150);
            near(rect(window),geometry.layoutRect('half-right',area,initial,12),'Padding');
            ext.settings.set_boolean('pad-maximized',true); ext.perform('maximize',window); await pause(150);
            check(!window.is_maximized(),'Padded maximize must be an ordinary window');
            near(rect(window),geometry.layoutRect('maximize',area,initial,12),'Padded maximize');
            ext.settings.set_int('padding',0); ext.settings.set_boolean('pad-maximized',false);
            passed.push('Padding and padded maximization');
            window.make_fullscreen(); await pause(150); ext.perform('half-left',window); await pause(150);
            check(!window.is_fullscreen(),'Tiling did not leave fullscreen');
            ext.perform('undo',window); await pause(150); check(window.is_fullscreen(),'Undo did not restore fullscreen');
            window.unmake_fullscreen(); await pause(150);
            passed.push('Fullscreen transitions and undo');
            const seat=global.stage.context.get_backend().get_default_seat();
            this.pointer=seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
            this.keyboard=seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
            const key=(value,pressed)=>this.keyboard.notify_keyval(GLib.get_monotonic_time(),value,pressed?Clutter.KeyState.PRESSED:Clutter.KeyState.RELEASED);
            const motion=(x,y)=>this.pointer.notify_absolute_motion(GLib.get_monotonic_time(),x,y);
            const button=pressed=>this.pointer.notify_button(GLib.get_monotonic_time(),1,pressed?Clutter.ButtonState.PRESSED:Clutter.ButtonState.RELEASED);
            window.unmaximize(); window.move_resize_frame(true,area.x+200,area.y+100,600,400); window.activate(global.get_current_time()); await pause(200);
            key(Clutter.KEY_Super_L,true); key(Clutter.KEY_Control_L,true); key(Clutter.KEY_Alt_L,true); key(Clutter.KEY_Right,true); await pause(80);
            key(Clutter.KEY_Right,false); key(Clutter.KEY_Alt_L,false); key(Clutter.KEY_Control_L,false); key(Clutter.KEY_Super_L,false); await pause(200);
            near(rect(window),geometry.layoutRect('half-right',area,initial),'Actual keyboard shortcut');
            passed.push('Registered shortcut via virtual keyboard input');
            ext.perform('undo',window); await pause(150);
            Main.overview.hide(); await pause(200);
            const beforeDrag=rect(window);
            const stream=Gio.File.new_for_path(`${root}/.test-session/before-drag.png`).replace(null,false,Gio.FileCreateFlags.NONE,null);
            await new Promise(resolve=>{const shot=new Shell.Screenshot(); shot.screenshot(false,stream,(_s,result)=>{shot.screenshot_finish(result); stream.close(null); resolve();});});
            motion(beforeDrag.x+180,beforeDrag.y+80); await pause(100); key(Clutter.KEY_Super_L,true); await pause(80); button(true); await pause(100); check(window.begin_grab_op(Meta.GrabOp.MOVING,global.stage.context.get_backend().get_pointer_sprite(global.stage),global.get_current_time(),null),'Cannot begin pointer grab'); await pause(80);
            motion(area.x+1,area.y+300); await pause(350);
            check(ext.preview.visible,'Drag preview not shown');
            button(false); key(Clutter.KEY_Super_L,false); await pause(300);
            near(rect(window),geometry.layoutRect('half-left',area,initial),'Actual edge drag');
            passed.push('Compositor pointer grab: edge detection, delayed preview, snap on release');
            const snapped=rect(window); motion(snapped.x+180,snapped.y+80); await pause(80); key(Clutter.KEY_Super_L,true); await pause(80); button(true); await pause(80); check(window.begin_grab_op(Meta.GrabOp.MOVING,global.stage.context.get_backend().get_pointer_sprite(global.stage),global.get_current_time(),null),'Cannot begin restore grab'); await pause(80);
            motion(area.x+400,area.y+150); await pause(200); button(false); key(Clutter.KEY_Super_L,false); await pause(200);
            check(Math.abs(rect(window).width-beforeDrag.width)<=2,'Drag did not restore original width');
            passed.push('Dragging a snapped window restores its prior size');
            // Escape and leaving the zone must cancel an armed snap.
            const startGrab=async()=>{
                Main.overview.hide(); await pause(200);
                const r=rect(window); motion(r.x+150,r.y+80); await pause(100); button(true); await pause(100);
                check(window.begin_grab_op(Meta.GrabOp.MOVING,global.stage.context.get_backend().get_pointer_sprite(global.stage),global.get_current_time(),null),'Cannot start cancellation grab'); await pause(80);
            };
            await startGrab(); motion(area.x+1,area.y+300); await pause(300);
            check(ext.preview.visible,'Cancellation preview missing');
            key(Clutter.KEY_Escape,true); await pause(100); key(Clutter.KEY_Escape,false); button(false); await pause(200);
            check(!ext.preview.visible,'Escape left preview visible');
            check(!geometry.sameRect(rect(window),geometry.layoutRect('half-left',area,initial)),'Escape committed a snap');
            await startGrab(); motion(area.x+1,area.y+300); await pause(300); motion(area.x+400,area.y+200); await pause(100); button(false); await pause(200);
            check(!ext.preview.visible && !geometry.sameRect(rect(window),geometry.layoutRect('half-left',area,initial)),'Leaving edge committed a snap');
            passed.push('Escape and release outside the snap zone cancel snapping');
            // Verify Alt and the actual Mod4 mask reported for Super.
            for(const [modifier,keyval] of [['alt',Clutter.KEY_Alt_L],['super',Clutter.KEY_Super_L]]) {
                ext.settings.set_string('thirds-modifier',modifier); await pause(60);
                await startGrab(); key(keyval,true); motion(area.x+1,area.y+300); await pause(300);
                check(ext.drag?.layout==='third-left',`${modifier} modifier did not select thirds`);
                button(false); key(keyval,false); await pause(200);
                near(rect(window),geometry.layoutRect('third-left',area,initial),`${modifier} third snap`);
                ext.perform('undo',window); await pause(150);
            }
            passed.push('Alt and Super modifier snapping to thirds');
            ext.settings.set_strv('shortcut-half-left',['<Super>Page_Up']); await pause(100);
            check(!ext.bindings.includes('shortcut-half-left'),'Conflicting native shortcut was registered');
            ext.settings.reset('shortcut-half-left'); await pause(100);
            check(ext.bindings.includes('shortcut-half-left'),'Restoring shortcut did not register it');
            ext.settings.set_boolean('hotkeys-enabled',false); await pause(100); check(ext.bindings.length===0,'Hotkeys toggle failed');
            ext.settings.set_boolean('hotkeys-enabled',true); await pause(100);
            passed.push('Native shortcut conflicts are skipped; hotkey toggles rebind cleanly');
            const fixture=async(backend,fixed)=>{
                const launcher=new Gio.SubprocessLauncher({flags:Gio.SubprocessFlags.NONE}); launcher.setenv('GDK_BACKEND',backend,true);
                const proc=launcher.spawnv(['gjs','-m',`${root}/tests/test-window.js`,fixed?'fixed':'normal']);
                let fixtureWindow;
                for(let i=0;i<50;i++){await pause(100);fixtureWindow=global.get_window_actors().map(a=>a.meta_window).find(w=>w!==window&&w.get_title()===(fixed?'Better Tiles Fixed Window':'Better Tiles Test Window')&&w.get_frame_rect().width>100);if(fixtureWindow)break;}
                check(fixtureWindow,`${backend} fixture did not map`);
                const prior=rect(fixtureWindow), a=fixtureWindow.get_work_area_for_monitor(fixtureWindow.get_monitor());
                ext.perform('half-right',fixtureWindow); await pause(200);
                if(fixed) near(rect(fixtureWindow),prior,'Fixed-size window must not resize');
                else near(rect(fixtureWindow),geometry.layoutRect('half-right',a,prior),'XWayland tiling');
                proc.force_exit(); await pause(100);
            };
            await fixture('wayland',true); passed.push('Fixed-size windows are not resized');
            await fixture('x11',false); passed.push('XWayland window tiling');
            ext.disable(); await pause(100);
            check(ext.bindings.length===0&&ext.signals.length===0&&!ext.preview&&!ext.indicator&&!ext.dragTimer&&ext.pending.size===0,'Cleanup incomplete');
            const nativeSettings=new Gio.Settings({schema_id:'org.gnome.mutter'});
            check(nativeSettings.get_boolean('edge-tiling'),'Native snapping not restored');
            nativeSettings.reset('edge-tiling');
            check(nativeSettings.get_boolean('edge-tiling'),'Test requires native snapping to be enabled by default');
            ext.enable(); await pause(100);
            ext.disable(); await pause(100);
            check(nativeSettings.get_user_value('edge-tiling')===null,'Native snapping left an explicit setting after disable');
            ext.getSettings().set_string('native-edge-tiling-prior','default');
            nativeSettings.set_boolean('edge-tiling',false);
            ext.enable(); await pause(100);
            ext.disable(); await pause(100);
            check(nativeSettings.get_boolean('edge-tiling')&&nativeSettings.get_user_value('edge-tiling')===null,'Native snapping did not recover after interrupted shutdown');
            ext.enable(); await pause(150);
            check(ext.bindings.length===18,'Shortcuts not re-registered');
            passed.push('Disable/re-enable removes resources and restores native snapping, including after interrupted shutdown');
            this.process.force_exit();
            this.process=Gio.Subprocess.new(['gjs','-m',`${root}/tests/test-preferences.js`], Gio.SubprocessFlags.NONE);
            await pause(1500);
            check(Gio.File.new_for_path(`${root}/.test-session/preferences-ok`).query_exists(null),'Preferences did not load');
            passed.push('All four GTK4/libadwaita preferences pages load');
            const prefsWindow=global.get_window_actors().map(a=>a.meta_window).find(w=>w.get_title()==='Better Tiles');
            check(prefsWindow,'Preferences window not found');
            Main.overview.hide(); await pause(400); prefsWindow.activate(global.get_current_time()); await pause(200);
            for(const page of ['general','hotkeys','snap-to-edges','about']) {
                GLib.file_set_contents(`${root}/.test-session/preferences-page`,page); await pause(300);
                const r=rect(prefsWindow), stream=Gio.File.new_for_path(`${root}/.test-session/preferences-${page}.png`).replace(null,false,Gio.FileCreateFlags.NONE,null);
                await new Promise(resolve=>{const shot=new Shell.Screenshot(); shot.screenshot_area(r.x,r.y,r.width,r.height,stream,(_s,result)=>{shot.screenshot_area_finish(result);stream.close(null);resolve();});});
            }

            GLib.file_set_contents(`${root}/.test-session/result.json`,JSON.stringify({ok:true,passed}));
        } catch(error){
            console.error(error);
            GLib.file_set_contents(`${root}/.test-session/result.json`,JSON.stringify({ok:false,passed,error:String(error),stack:error.stack}));
        }
    }
}
