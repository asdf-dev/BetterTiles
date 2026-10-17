import type {Edge, Layout} from './actions.js';
export interface Rect { x: number; y: number; width: number; height: number }
const FRACTIONS: Record<Exclude<Layout, 'center'>, readonly [number, number, number, number]> = {
    'half-left': [0, 0, .5, 1], 'half-right': [.5, 0, 1, 1],
    'half-top': [0, 0, 1, .5], 'half-bottom': [0, .5, 1, 1],
    'top-left': [0, 0, .5, .5], 'top-right': [.5, 0, 1, .5],
    'bottom-left': [0, .5, .5, 1], 'bottom-right': [.5, .5, 1, 1],
    'third-left': [0, 0, 1 / 3, 1], 'third-center': [1 / 3, 0, 2 / 3, 1], 'third-right': [2 / 3, 0, 1, 1],
    'two-thirds-left': [0, 0, 2 / 3, 1], 'two-thirds-center': [1 / 6, 0, 5 / 6, 1],
    'two-thirds-right': [1 / 3, 0, 1, 1], 'maximize': [0, 0, 1, 1],
};
export function copyRect(r: Rect): Rect { return {x: r.x, y: r.y, width: r.width, height: r.height}; }
export function sameRect(a: Rect, b: Rect, tolerance = 2): boolean {
    return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance
        && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
}
export function fitRect(r: Rect, area: Rect): Rect {
    const width = Math.min(r.width, area.width), height = Math.min(r.height, area.height);
    return {x: Math.round(Math.max(area.x, Math.min(r.x, area.x + area.width - width))),
        y: Math.round(Math.max(area.y, Math.min(r.y, area.y + area.height - height))), width, height};
}
export function layoutRect(layout: Layout, area: Rect, current: Rect, gap = 0): Rect {
    if (layout === 'center') {
        const r = fitRect(current, area);
        return {...r, x: Math.round(area.x + (area.width - r.width) / 2), y: Math.round(area.y + (area.height - r.height) / 2)};
    }
    const [left, top, right, bottom] = FRACTIONS[layout];
    // Outer margins are a full gap; each side of an internal boundary contributes half.
    const padding = Math.max(0, Math.min(gap, Math.floor(Math.min(area.width, area.height) / 8)));
    const x = Math.round(area.x + area.width * left + (left === 0 ? padding : padding / 2));
    const y = Math.round(area.y + area.height * top + (top === 0 ? padding : padding / 2));
    const endX = Math.round(area.x + area.width * right - (right === 1 ? padding : padding / 2));
    const endY = Math.round(area.y + area.height * bottom - (bottom === 1 ? padding : padding / 2));
    return {x, y, width: Math.max(1, endX - x), height: Math.max(1, endY - y)};
}
export function edgeAt(x: number, y: number, monitor: Rect, thickness: number): Edge | null {
    if (x < monitor.x || y < monitor.y || x >= monitor.x + monitor.width || y >= monitor.y + monitor.height) return null;
    const t = Math.max(1, thickness);
    const left = x < monitor.x + t, right = x >= monitor.x + monitor.width - t;
    const top = y < monitor.y + t, bottom = y >= monitor.y + monitor.height - t;
    if (top && left) return 'top-left';
    if (top && right) return 'top-right';
    if (bottom && left) return 'bottom-left';
    if (bottom && right) return 'bottom-right';
    return left ? 'left' : right ? 'right' : top ? 'top' : bottom ? 'bottom' : null;
}
export function transferRect(r: Rect, from: Rect, to: Rect): Rect {
    return fitRect({x: to.x + (r.x - from.x) / from.width * to.width,
        y: to.y + (r.y - from.y) / from.height * to.height, width: r.width, height: r.height}, to);
}
export function cycleThird(current: Rect, area: Rect, direction: 1 | -1, gap: number): Layout {
    const thirds = ['third-left', 'third-center', 'third-right'] as const;
    const index = thirds.findIndex(layout => sameRect(current, layoutRect(layout, area, current, gap)));
    return thirds[index < 0 ? (direction === 1 ? 0 : 2) : (index + direction + 3) % 3]!;
}
