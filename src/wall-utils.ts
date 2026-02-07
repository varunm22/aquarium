import { Vector } from './vector.js';
import { getTankBounds } from './constants.js';

export type Wall = 'front' | 'back' | 'left' | 'right' | 'bottom';
export type SideWall = 'front' | 'back' | 'left' | 'right';

export interface WallPoint {
    wall: Wall;
    x: number;
    y: number;
}

/** Convert a 3D world position to 2D wall coordinates.
 *  front/back: (worldX, worldY), left/right: (worldZ, worldY), bottom: (worldX, worldZ) */
export function world3DToWall2D(pos: Vector, wall: Wall): WallPoint {
    switch (wall) {
        case 'front':
        case 'back':
            return { wall, x: pos.x, y: pos.y };
        case 'left':
        case 'right':
            return { wall, x: pos.z, y: pos.y };
        case 'bottom':
            return { wall, x: pos.x, y: pos.z };
    }
}

/** Convert 2D wall coordinates back to 3D, snapping to the wall surface at the given offset */
export function wall2DToWorld3D(wallPoint: WallPoint, wallOffset: number): Vector {
    const bounds = getTankBounds();
    switch (wallPoint.wall) {
        case 'front':
            return new Vector(wallPoint.x, wallPoint.y, bounds.min.z + wallOffset);
        case 'back':
            return new Vector(wallPoint.x, wallPoint.y, bounds.max.z - wallOffset);
        case 'left':
            return new Vector(bounds.min.x + wallOffset, wallPoint.y, wallPoint.x);
        case 'right':
            return new Vector(bounds.max.x - wallOffset, wallPoint.y, wallPoint.x);
        case 'bottom':
            return new Vector(wallPoint.x, bounds.max.y - wallOffset, wallPoint.y);
    }
}

/** Convert a 2D velocity on a wall to a 3D velocity vector */
export function wall2DToWorld3DVelocity(wallPoint: WallPoint): Vector {
    switch (wallPoint.wall) {
        case 'front':
        case 'back':
            return new Vector(wallPoint.x, wallPoint.y, 0);
        case 'left':
        case 'right':
            return new Vector(0, wallPoint.y, wallPoint.x);
        case 'bottom':
            return new Vector(wallPoint.x, 0, wallPoint.y);
    }
}

/** Get 2D bounds for a wall in wall-coordinate space */
export function getWall2DBounds(wall: Wall): { minX: number, maxX: number, minY: number, maxY: number } {
    const bounds = getTankBounds();
    switch (wall) {
        case 'front':
        case 'back':
            return { minX: bounds.min.x, maxX: bounds.max.x, minY: bounds.min.y, maxY: bounds.max.y };
        case 'left':
        case 'right':
            return { minX: bounds.min.z, maxX: bounds.max.z, minY: bounds.min.y, maxY: bounds.max.y };
        case 'bottom':
            return { minX: bounds.min.x, maxX: bounds.max.x, minY: bounds.min.z, maxY: bounds.max.z };
    }
}

/** Config describing each wall's fixed (perpendicular) axis and boundary side */
export const WALL_CONFIG: Record<Wall, { fixedAxis: 'x' | 'y' | 'z', fixedAtMax: boolean }> = {
    'front': { fixedAxis: 'z', fixedAtMax: false },
    'back':  { fixedAxis: 'z', fixedAtMax: true },
    'left':  { fixedAxis: 'x', fixedAtMax: false },
    'right': { fixedAxis: 'x', fixedAtMax: true },
    'bottom': { fixedAxis: 'y', fixedAtMax: true },
};

/** Get the opposite wall (front<->back, left<->right). Bottom has no opposite. */
export function getOppositeWall(wall: Wall): Wall | null {
    switch (wall) {
        case 'front': return 'back';
        case 'back': return 'front';
        case 'left': return 'right';
        case 'right': return 'left';
        default: return null;
    }
}

/** Get walls adjacent to the given wall */
export function getAdjacentWalls(wall: Wall): Wall[] {
    const connections: { [key in Wall]: Wall[] } = {
        'front': ['left', 'right', 'bottom'],
        'back': ['left', 'right', 'bottom'],
        'left': ['front', 'back', 'bottom'],
        'right': ['front', 'back', 'bottom'],
        'bottom': ['front', 'back', 'left', 'right']
    };
    return connections[wall];
}
