import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {buildPreferences} from './preferences.js';
export default class BetterTilesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        buildPreferences(window, this.getSettings(), this.metadata['version-name'] ?? '0.1.0');
        return Promise.resolve();
    }
}
