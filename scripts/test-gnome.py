#!/usr/bin/env python3
"""Run a real GNOME Shell with private D-Bus, settings, data, and virtual monitors."""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
from zipfile import ZipFile

root = Path(__file__).resolve().parent.parent
metadata = json.loads((root / 'metadata.json').read_text())
uuid = metadata['uuid']
shell_version = metadata['shell-version'][0]
session = root / '.test-session'
if session.exists():
    shutil.rmtree(session)
for part in ('data', 'config', 'cache', 'runtime'):
    (session / part).mkdir(parents=True, mode=0o700)
env = dict(os.environ)
for key in ('DISPLAY', 'WAYLAND_DISPLAY', 'DBUS_SESSION_BUS_ADDRESS', 'SESSION_MANAGER'):
    env.pop(key, None)
env.update(XDG_DATA_HOME=str(session / 'data'), XDG_CONFIG_HOME=str(session / 'config'),
           XDG_CACHE_HOME=str(session / 'cache'), XDG_RUNTIME_DIR=str(session / 'runtime'),
           GSETTINGS_BACKEND='keyfile', BETTER_TILES_TEST_ROOT=str(root), BETTER_TILES_UUID=uuid,
           XDG_SESSION_TYPE='wayland', XDG_CURRENT_DESKTOP='GNOME', GTK_A11Y='none', GSK_RENDERER='cairo', GDK_BACKEND='wayland')
bus = subprocess.check_output(['dbus-daemon', '--session', '--fork', '--print-address=1', '--print-pid=1'], env=env, text=True).splitlines()
env['DBUS_SESSION_BUS_ADDRESS'] = bus[0]
extensions = session / 'data/gnome-shell/extensions'
if len(sys.argv) > 1:
    with ZipFile(sys.argv[1]) as package:
        package.extractall(extensions / uuid)
    subprocess.run(['glib-compile-schemas', '--strict', str(extensions / uuid / 'schemas')], check=True)
else:
    shutil.copytree(root / 'dist', extensions / uuid)
harness = extensions / 'better-tiles-test@local'
harness.mkdir()
(harness / 'metadata.json').write_text(json.dumps({'uuid':'better-tiles-test@local','name':'Better Tiles integration harness','description':'Private integration test','shell-version':[shell_version]}))
shutil.copy(root / 'tests/harness-extension.js', harness / 'extension.js')
for schema, key, value in [
    ('org.gnome.shell','enabled-extensions',str([uuid, 'better-tiles-test@local'])),
    ('org.gnome.shell','disable-user-extensions','false'),
    ('org.gnome.shell','welcome-dialog-last-shown-version',"'999'"),
    ('org.gnome.desktop.interface','enable-animations','false'),
    ('org.gnome.mutter','edge-tiling','true'),
]:
    subprocess.run(['gsettings','set',schema,key,value],env=env,check=True)
log = open(session / 'shell.log', 'w')
shell = None
try:
    shell = subprocess.Popen(['gnome-shell','--headless','--wayland','--wayland-display=better-tiles-test',
                              '--virtual-monitor','1280x800','--virtual-monitor','1600x900'],env=env,
                             stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    deadline = time.monotonic() + 100
    result = session / 'result.json'
    while time.monotonic() < deadline and shell.poll() is None and not result.exists():
        time.sleep(.25)
    if result.exists():
        report = json.loads(result.read_text())
        print(json.dumps(report,indent=2))
        if not report['ok']: raise SystemExit(1)
    else:
        print((session / 'shell.log').read_text()[-14000:])
        raise SystemExit('GNOME integration test did not produce a result')
finally:
    if shell and shell.poll() is None:
        os.killpg(shell.pid, signal.SIGTERM)
        try: shell.wait(timeout=5)
        except subprocess.TimeoutExpired: os.killpg(shell.pid,signal.SIGKILL)
    os.kill(int(bus[1]),signal.SIGTERM)
    log.close()
