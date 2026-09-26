export type Point = readonly [x: number, y: number];

/** A cubic Bézier from the previous curve's end: two control points, then its own end. */
type Curve = readonly [x1: number, y1: number, x2: number, y2: number, x: number, y: number];

/** A run of cubic curves from a starting point, in map units. */
interface Trace {
    start: Point;
    curves: readonly Curve[];
}

/*
 * The Grand Prix circuit at Canadian Tire Motorsport Park (Mosport), from Will
 * Pittenger's CC0 diagram https://commons.wikimedia.org/wiki/File:Mosport-CTMP.svg.
 * Its centre line and pit lane keep the diagram's cubic curves, turned 8°
 * anticlockwise and scaled uniformly, never stretched or mirrored. The
 * viewBox leaves room for labels. The centre line is split at the diagram's
 * start/finish marker so a lap begins there. Turn numbers follow the circuit's
 * own map, https://canadiantiremotorsportpark.com/pages/facility-map.
 */

/** The centre line, driven clockwise from the start/finish line on the pit straight. */
export const CIRCUIT: Trace = {
    start: [493, 292.8],
    curves: [
        [482.9, 301.3, 472.8, 309.5, 462.7, 317.7],
        [459.2, 320.5, 454.9, 322.4, 450.6, 323.7],
        [445.8, 325.2, 440.1, 325.5, 435.1, 325.3],
        [428, 325.1, 420.7, 324.2, 414.3, 321.4],
        [406.8, 318, 394.2, 307.1, 390.3, 299.7],
        [373, 266.7, 365.3, 249.5, 345.9, 214.6],
        [342.5, 208.4, 332.6, 196.2, 327.2, 191.9],
        [321.8, 187.7, 314.7, 184.9, 308.1, 182.9],
        [301, 180.9, 293.6, 179.9, 286.1, 179.9],
        [280.2, 179.9, 274.1, 180.6, 268.6, 182.4],
        [263.2, 184.1, 250.9, 192.9, 247.4, 197.4],
        [230.6, 219, 219.5, 233.3, 203.3, 256.7],
        [200.6, 260.7, 194.2, 266.5, 189.9, 268.5],
        [183.8, 271.2, 176.9, 272.8, 170.2, 273],
        [165.1, 273.2, 159.6, 270.7, 155.1, 268.2],
        [149.3, 264.9, 145, 260.9, 141.2, 255.4],
        [136.2, 248.3, 130.2, 238.8, 128, 230.4],
        [123.5, 213, 121.4, 196.8, 119.5, 178.8],
        [117.4, 159.5, 116.2, 139.9, 112.3, 121.1],
        [111, 114.5, 107.3, 108.4, 103.9, 102.6],
        [99.7, 95.4, 95.2, 88, 89.5, 82],
        [84.8, 77, 79, 72.6, 72.8, 69.4],
        [61.5, 63.6, 45.4, 57.6, 34.3, 51.3],
        [26.1, 46.6, 26.8, 34.4, 29.4, 27.4],
        [31, 23.1, 33.7, 16.8, 36.9, 14.8],
        [41.6, 11.8, 46.9, 15.9, 50.4, 18.2],
        [58.4, 23.4, 66.1, 27.2, 75.2, 30.8],
        [84.1, 34.3, 93.9, 37, 103.4, 36.7],
        [125.4, 36.2, 147.7, 30.6, 169.9, 27.4],
        [192.5, 24.1, 215.3, 20, 238.1, 19],
        [270.1, 17.6, 332.5, 13.7, 365.8, 18.1],
        [412.9, 24.4, 454.7, 37.6, 500.2, 51.3],
        [509.8, 54.2, 523.6, 61.2, 529.7, 68.6],
        [535.3, 75.4, 540.5, 84.6, 542.4, 93.6],
        [544.5, 103.9, 544.1, 115.7, 541.6, 125.8],
        [538.9, 136.7, 529.8, 145.8, 527.8, 156.6],
        [526.3, 164.4, 527.9, 174.6, 532.4, 181.1],
        [538.7, 190.3, 546, 197.3, 553.4, 206.3],
        [556.9, 210.5, 558.4, 217.2, 558.1, 222.5],
        [557.8, 227.6, 556.7, 233.4, 553.2, 237.5],
        [540.3, 252.4, 524, 266.5, 508.8, 279.4],
        [503.5, 284, 498.2, 288.4, 493, 292.8],
    ],
};

/** The pit lane, inside the pit straight from its entry at turn 10 to its exit beyond turn 1. */
export const PIT: Trace = {
    start: [545.9, 200],
    curves: [
        [547.3, 202.2, 552.7, 210.1, 553.3, 212.5],
        [553.9, 215, 554.8, 219.9, 554.4, 222.4],
        [553.9, 225.5, 553.6, 227.6, 552.2, 230.5],
        [550.7, 233.7, 548.5, 236.1, 546.3, 238.9],
        [543.6, 242.2, 539.8, 244.6, 536.6, 247.4],
        [530.1, 253, 523.2, 258.2, 516.8, 263.9],
        [508.5, 271.1, 500.9, 278.9, 492.6, 286.1],
        [484, 293.4, 475.3, 300.5, 466.3, 307.3],
        [461.8, 310.8, 457.1, 314.5, 452.1, 317.1],
        [448.7, 318.9, 444.8, 320.4, 441, 320.7],
        [435.8, 321.2, 430.2, 320.7, 425, 319.7],
        [420.7, 318.9, 416.3, 317.3, 412.4, 315.1],
        [407.9, 312.7, 403.5, 309.7, 399.9, 306.1],
        [394.7, 300.8, 385.9, 285.7, 381.8, 279.8],
    ],
};

/**
 * Turn numbers stay clear of passing cars, including the leader's ring,
 * at the map's largest label size. Moss Corner, turns 5a to 5c, takes one number.
 */
export const TURNS = [
    { name: "1", x: 435.4, y: 355.3 },
    { name: "2", x: 286.9, y: 209.9 },
    { name: "3", x: 173.1, y: 241.7 },
    { name: "4", x: 85.1, y: 135.4 },
    { name: "5", x: -0.8, y: 34.9 },
    { name: "6", x: 243.4, y: 48.8 },
    { name: "7", x: 341.9, y: 46.4 },
    { name: "8", x: 572.4, y: 99.5 },
    { name: "9", x: 557.3, y: 162.4 },
    { name: "10", x: 593.6, y: 219.7 },
] as const;
