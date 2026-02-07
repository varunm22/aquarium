import { Vector } from './vector.js';

export const TANK_CONSTANTS = {
    X: 75,
    Y: 200,
    WIDTH: 700,
    HEIGHT: 430,
    DEPTH: 400,
    GRAVEL_HEIGHT: 20,
    WATER_LEVEL_PERCENT: 0.1,
    BACK_SCALE: 0.7,
    MIN_Z: 20,
} as const;

export function getTankBounds() {
    return {
        min: new Vector(
            TANK_CONSTANTS.X, 
            TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT, 
            TANK_CONSTANTS.MIN_Z
        ),
        max: new Vector(
            TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH,
            TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT,
            TANK_CONSTANTS.DEPTH
        )
    };
}
