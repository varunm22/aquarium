import { Vector } from './vector.js';
// Tank dimensions and positioning will be calculated relative to these base values
export const TANK_CONSTANTS = {
    // Base position and dimensions
    X: 150,
    Y: 200,
    WIDTH: 700,
    HEIGHT: 430,
    DEPTH: 400,
    // Gravel settings
    GRAVEL_HEIGHT: 20,
    // Water level (as percentage from top)
    WATER_LEVEL_PERCENT: 0.1,
    // Back pane scale (relative to front)
    BACK_SCALE: 0.7,
    // Movement bounds
    MIN_Z: 20, // Minimum z-coordinate for fish movement
};
// Derived constants can be calculated here
export function getTankBounds() {
    return {
        min: new Vector(TANK_CONSTANTS.X, TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT, TANK_CONSTANTS.MIN_Z),
        max: new Vector(TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH, TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT, TANK_CONSTANTS.DEPTH)
    };
}
