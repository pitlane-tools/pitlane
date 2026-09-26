import { CIRCUIT, PIT, type Point } from "./mosport.ts";

/** Evenly spaced positions along one lap, fine enough for curvature. */
const SAMPLES = 480;
/** How long the leader takes over a lap. */
export const LAP_MS = 16_000;
/**
 * Where each car is, as a fraction of the lap's time, when the page draws
 * still. The same timing curve moves every car, so a car stays the same time
 * behind the one ahead and the order never changes.
 */
const FORMATION = [0.07, 0.035, 0.005, -0.025] as const;

/**
 * The lap model's limits, in track units per unit time: the grip that caps
 * speed through a corner, and how quickly a car gains or sheds speed.
 */
const GRIP = 0.0055;
const ACCELERATION = 0.0016;
const BRAKING = 0.003;

/** The item at `index` of a closed loop, wrapping either way. */
let at = <item>(items: readonly item[], index: number) =>
    items[((index % items.length) + items.length) % items.length]!;

function bezier([a, b, c, d]: Point[], u: number): Point {
    let v = 1 - u;
    let [w0, w1, w2, w3] = [v * v * v, 3 * v * v * u, 3 * v * u * u, u * u * u];
    return [
        w0 * a![0] + w1 * b![0] + w2 * c![0] + w3 * d![0],
        w0 * a![1] + w1 * b![1] + w2 * c![1] + w3 * d![1],
    ];
}

/** Coordinates to a tenth of a unit keep the markup short and the drawing exact at any size. */
let round = (value: number) => Math.round(value * 10) / 10;

let from = CIRCUIT.start;
/** The circuit's curves as cubic Béziers, each starting where the one before it ends. */
let curves = CIRCUIT.curves.map(([x1, y1, x2, y2, x, y]) => {
    let curve: Point[] = [from, [x1, y1], [x2, y2], [x, y]];
    from = [x, y];
    return curve;
});

/** The circuit as SVG path data, shared by the drawing and the cars' motion path. */
export const TRACK = `M${CIRCUIT.start.join(" ")}${CIRCUIT.curves.map(curve => `C${curve.join(" ")}`).join("")}Z`;
export const PIT_LANE = `M${PIT.start.join(" ")}${PIT.curves.map(curve => `C${curve.join(" ")}`).join("")}`;

/** `count` points spaced evenly by distance along the closed curve, and its length. */
function resample(count: number): { points: Point[]; length: number } {
    let dense = curves.flatMap(curve =>
        Array.from({ length: 64 }, (_, u) => bezier(curve, u / 64)),
    );
    dense.push(dense[0]!);
    let distances = [0];
    for (let index = 1; index < dense.length; index++) {
        let [a, b] = [dense[index - 1]!, dense[index]!];
        distances.push(distances[index - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    let length = distances.at(-1)!;
    let points: Point[] = [];
    let cursor = 0;
    for (let index = 0; index < count; index++) {
        let target = (index / count) * length;
        while (distances[cursor + 1]! < target) cursor++;
        let [a, b] = [dense[cursor]!, dense[cursor + 1]!];
        let u = (target - distances[cursor]!) / (distances[cursor + 1]! - distances[cursor]!);
        points.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return { points, length };
}

let { points, length } = resample(SAMPLES);
let step = length / SAMPLES;

let headings = points.map((_, index) => {
    let [a, b] = [at(points, index - 1), at(points, index + 1)];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
});

/** Positive when the lap runs clockwise on screen, where y grows downward. */
let winding = Math.sign(
    points.reduce((sum, [x, y], index) => {
        let [nx, ny] = at(points, index + 1);
        return sum + x * ny - nx * y;
    }, 0),
);

/** The unit normal at a sample, pointing into the infield. */
function inward(index: number): Point {
    let heading = at(headings, index);
    return [-Math.sin(heading) * winding, Math.cos(heading) * winding];
}

/**
 * The timing curve of one lap: the fraction of the lap's time at which a car
 * reaches each sample. Speed follows a lateral-grip limit from curvature, then
 * a forward pass for acceleration and a backward pass for braking, so cars
 * slow into corners and gain on the straights as a lap trace does.
 */
function lapTimes(): number[] {
    let turn = (index: number) => {
        let delta = at(headings, index + 2) - at(headings, index - 2);
        return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) / (4 * step);
    };
    let limit = points.map((_, index) =>
        Math.min(1, Math.sqrt(GRIP / Math.max(turn(index), 1e-6))),
    );
    let speed = [...limit];
    // Two laps each way settle the passes across the closing sample.
    for (let pass = 0; pass < 2 * SAMPLES; pass++) {
        let index = pass % SAMPLES;
        speed[index] = Math.min(
            limit[index]!,
            Math.sqrt(at(speed, index - 1) ** 2 + 2 * ACCELERATION * step),
        );
    }
    for (let pass = 2 * SAMPLES - 1; pass >= 0; pass--) {
        let index = pass % SAMPLES;
        speed[index] = Math.min(
            speed[index]!,
            Math.sqrt(at(speed, index + 1) ** 2 + 2 * BRAKING * step),
        );
    }
    let times = [0];
    for (let index = 0; index < SAMPLES; index++) {
        times.push(times[index]! + (2 * step) / (speed[index]! + at(speed, index + 1)));
    }
    let lap = times.at(-1)!;
    return times.map(time => time / lap);
}

/** Every fourth sample of the lap: when a car reaches it, as a fraction of the lap, and how far along the track it is, as a percentage. */
let timing = lapTimes()
    .filter((_, index) => index % 4 === 0)
    .map((time, index) => ({ time, distance: (index * 400) / SAMPLES }));

/** Every car's motion over one lap: time on the keyframe offsets, distance along the track. */
export const KEYFRAMES: Keyframe[] = timing.map(({ time, distance }) => ({
    offset: time,
    offsetDistance: `${distance}%`,
}));

/** How far along the track a car is, as a percentage, a given fraction of the way into its lap. */
function distanceAt(phase: number): string {
    let time = phase - Math.floor(phase);
    let next = timing.findIndex(sample => sample.time > time);
    let [from, to] = [timing[next - 1]!, timing[next]!];
    let u = (time - from.time) / (to.time - from.time);
    return `${round(from.distance + (to.distance - from.distance) * u)}%`;
}

/** A line across the track at a sample, `reach` either side of the centre line. */
function across(index: number, reach: number) {
    let [x, y] = at(points, index);
    let [nx, ny] = inward(index);
    return {
        x1: round(x - nx * reach),
        y1: round(y - ny * reach),
        x2: round(x + nx * reach),
        y2: round(y + ny * reach),
    };
}

/** A point `distance` off the centre line; negative is outside the circuit. */
function offset(index: number, distance: number): Point {
    let [x, y] = at(points, index);
    let [nx, ny] = inward(index);
    return [round(x + nx * distance), round(y + ny * distance)];
}

export const START_LINE = across(0, 8);
/** A chevron outside the straight after the line, pointing the way the lap runs. */
export const DIRECTION = `M${offset(6, -12).join(" ")}L${offset(9, -16).join(" ")}L${offset(6, -20).join(" ")}`;

export const RUNNERS = FORMATION.map((phase, position) => ({
    leader: position === 0,
    phase: phase - Math.floor(phase),
    distance: distanceAt(phase),
})).reverse();
