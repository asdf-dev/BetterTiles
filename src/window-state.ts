import type {Layout} from './actions.js';
import {sameRect, type Rect} from './geometry.js';

export interface Snapshot {
    rect: Rect;
    monitor: number;
    maximized: boolean;
    fullscreen: boolean;
}

const HISTORY_LIMIT = 20;

export class WindowState {
    private history: Snapshot[] = [];
    original?: Snapshot;
    target?: Rect;
    layout?: Layout;

    constructor(readonly unmanaged: number) {}

    remember(undoSnapshot: Snapshot, restoreSnapshot: Snapshot): void {
        this.history.push(undoSnapshot);
        if (this.history.length > HISTORY_LIMIT) this.history.shift();
        if (!this.original || !this.target || !sameRect(undoSnapshot.rect, this.target))
            this.original = restoreSnapshot;
    }

    undo(): Snapshot | undefined {
        const previous = this.history.pop();
        if (previous) this.clearTile();
        return previous;
    }

    clearTile(): void {
        this.original = undefined;
        this.target = undefined;
        this.layout = undefined;
    }
}
