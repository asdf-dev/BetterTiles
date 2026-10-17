import test from 'node:test';
import assert from 'node:assert/strict';
import {WindowState} from '../dist/window-state.js';

const snapshot = (x, width = 400) => ({rect: {x, y: 0, width, height: 300}, monitor: 0, maximized: false, fullscreen: false});

test('undo and drag restoration retain their distinct snapshots', () => {
    const state = new WindowState(1);
    const tiled = snapshot(0, 500);
    const restored = snapshot(80, 400);
    state.remember(tiled, restored);
    state.target = snapshot(500, 500).rect;
    state.layout = 'half-right';
    state.remember(snapshot(500, 500), snapshot(500, 500));
    assert.deepEqual(state.original, restored);
    assert.deepEqual(state.undo(), snapshot(500, 500));
    assert.equal(state.original, undefined);
    assert.equal(state.target, undefined);
    assert.deepEqual(state.undo(), tiled);
});

test('history keeps the latest twenty actions', () => {
    const state = new WindowState(1);
    for (let x = 0; x < 21; x++) state.remember(snapshot(x), snapshot(x));
    for (let x = 20; x >= 1; x--) assert.deepEqual(state.undo(), snapshot(x));
    assert.equal(state.undo(), undefined);
});
