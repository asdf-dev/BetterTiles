export const ACTIONS = [
    ['center', 'Center', '<Super><Control><Alt>c'],
    ['maximize', 'Maximize', '<Super><Control><Alt>f'],
    ['half-left', 'Half Left', '<Super><Control><Alt>Left'],
    ['half-right', 'Half Right', '<Super><Control><Alt>Right'],
    ['half-top', 'Half Top', '<Super><Control><Alt>Up'],
    ['half-bottom', 'Half Bottom', '<Super><Control><Alt>Down'],
    ['top-left', 'Upper Left', '<Super><Control><Alt>u'],
    ['top-right', 'Upper Right', '<Super><Control><Alt>i'],
    ['bottom-left', 'Lower Left', '<Super><Control><Alt>j'],
    ['bottom-right', 'Lower Right', '<Super><Control><Alt>k'],
    ['next-third', 'Next Third', '<Super><Control><Alt>period'],
    ['previous-third', 'Previous Third', '<Super><Control><Alt>comma'],
    ['two-thirds-left', 'Two Thirds Left', '<Super><Control><Alt><Shift>Left'],
    ['two-thirds-center', 'Two Thirds Center', '<Super><Control><Alt><Shift>Up'],
    ['two-thirds-right', 'Two Thirds Right', '<Super><Control><Alt><Shift>Right'],
    ['next-monitor', 'Next Display', '<Super><Control><Alt>Page_Down'],
    ['previous-monitor', 'Previous Display', '<Super><Control><Alt>Page_Up'],
    ['undo', 'Undo', '<Super><Control><Alt>z'],
] as const;
export type Action = typeof ACTIONS[number][0];
export type Layout = Exclude<Action, 'next-third' | 'previous-third' | 'next-monitor' | 'previous-monitor' | 'undo'>
    | 'third-left' | 'third-center' | 'third-right';
export const LAYOUTS: readonly [Layout | 'none', string][] = [
    ['none', 'Nothing'], ['maximize', 'Maximize'], ['center', 'Center'],
    ['half-left', 'Half Left'], ['half-right', 'Half Right'],
    ['half-top', 'Half Top'], ['half-bottom', 'Half Bottom'],
    ['top-left', 'Upper Left'], ['top-right', 'Upper Right'],
    ['bottom-left', 'Lower Left'], ['bottom-right', 'Lower Right'],
    ['third-left', 'Third Left'], ['third-center', 'Third Center'], ['third-right', 'Third Right'],
    ['two-thirds-left', 'Two Thirds Left'], ['two-thirds-center', 'Two Thirds Center'],
    ['two-thirds-right', 'Two Thirds Right'],
];
export const EDGES = [
    ['top-left', 'Top Left', 'top-left'], ['top', 'Top', 'maximize'], ['top-right', 'Top Right', 'top-right'],
    ['left', 'Left', 'half-left'], ['right', 'Right', 'half-right'],
    ['bottom-left', 'Bottom Left', 'bottom-left'], ['bottom', 'Bottom', 'none'], ['bottom-right', 'Bottom Right', 'bottom-right'],
] as const;
export type Edge = typeof EDGES[number][0];
