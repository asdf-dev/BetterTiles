import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutRect, edgeAt, cycleThird, transferRect, fitRect} from '../dist/geometry.js';
const area = {x: -1440, y: 32, width: 1441, height: 868};
const current = {x: -1300, y: 120, width: 600, height: 400};
test('halves cover an odd-width work area without gaps or overlap', () => {
    const left = layoutRect('half-left', area, current), right = layoutRect('half-right', area, current);
    assert.equal(left.x, area.x); assert.equal(left.x + left.width, right.x);
    assert.equal(right.x + right.width, area.x + area.width); assert.equal(left.y, 32);
});
test('padding gives one gap between adjacent tiles and full outer margins', () => {
    const left = layoutRect('half-left', area, current, 12), right = layoutRect('half-right', area, current, 12);
    assert.equal(left.x - area.x, 12); assert.equal(right.x - left.x - left.width, 12);
    assert.equal(area.x + area.width - right.x - right.width, 12);
});
test('thirds cycle in both directions and wrap', () => {
    const first = cycleThird(current, area, 1, 8); assert.equal(first, 'third-left');
    const second = cycleThird(layoutRect(first, area, current, 8), area, 1, 8); assert.equal(second, 'third-center');
    assert.equal(cycleThird(layoutRect('third-right', area, current, 8), area, 1, 8), 'third-left');
    assert.equal(cycleThird(layoutRect('third-left', area, current, 8), area, -1, 8), 'third-right');
});
test('corners take priority and a point belongs to only one monitor', () => {
    const m = {x: 0, y: 0, width: 1000, height: 800};
    assert.equal(edgeAt(0, 0, m, 16), 'top-left'); assert.equal(edgeAt(999, 799, m, 16), 'bottom-right');
    assert.equal(edgeAt(1000, 400, m, 16), null); assert.equal(edgeAt(500, 400, m, 16), null);
    assert.equal(edgeAt(500, 0, m, 16), 'top');
});
test('monitor transfers preserve size while fitting smaller work areas', () => {
    const to = {x: 0, y: 24, width: 500, height: 350};
    const moved = transferRect(current, area, to);
    assert.deepEqual(moved, to);
});
test('center preserves size and clamps oversized windows', () => {
    const r = layoutRect('center', area, current); assert.equal(r.width, 600); assert.equal(r.height, 400);
    assert.equal(r.x, Math.round(area.x + (area.width - 600) / 2));
    assert.deepEqual(fitRect({x: -9999,y: -9999,width: 9999,height: 9999}, area), area);
});
test('all fractional layouts remain inside the work area at small logical sizes', () => {
    const small = {x: -301, y: 30, width: 301, height: 200};
    for (const layout of ['third-left','third-center','third-right','two-thirds-left','two-thirds-center','two-thirds-right','bottom-left','top-right']) {
        const r = layoutRect(layout, small, current, 64);
        assert.ok(r.width > 0 && r.height > 0); assert.ok(r.x >= small.x && r.y >= small.y);
        assert.ok(r.x + r.width <= small.x + small.width); assert.ok(r.y + r.height <= small.y + small.height);
    }
});
