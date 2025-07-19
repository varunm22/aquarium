import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';
import { Food } from './food.js';
import { TANK_CONSTANTS, getTankBounds } from '../constants.js';

// Declare p5.js global functions
declare function lerp(start: number, stop: number, amt: number): number;
declare function push(): void;
declare function pop(): void;
declare function fill(r: number, g: number, b: number, a?: number): void;
declare function noStroke(): void;
declare function stroke(r: number, g: number, b: number, a?: number): void;
declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function ellipse(x: number, y: number, w: number, h: number): void;
declare function random(): number;
declare function image(img: p5.Image, x: number, y: number, w: number, h: number, sx: number, sy: number, sw: number, sh: number): void;
declare function loadImage(path: string): p5.Image;
declare function translate(x: number, y: number): void;
declare function rotate(angle: number): void;
declare function scale(x: number, y: number): void;

// Declare p5.Color type
declare namespace p5 {
  interface Color {}
  interface Image {}
}

type Wall = 'front' | 'back' | 'left' | 'right' | 'bottom';

interface PathPoint {
    position: Vector;
    wall: Wall;
}

interface SpriteConfig {
  x: number;  // x offset in spritesheet
  y: number;  // y offset in spritesheet
  width: number;  // width of sprite
  height: number;  // height of sprite
}

export class Snail extends Inhabitant {
    static spritesheet: p5.Image | null = null;
    static readonly SPRITE_CONFIGS: SpriteConfig[] = [
        { x: 10, y: 40, width: 48, height: 34 },    // 0: left
        { x: 80, y: 40, width: 40, height: 34 },   // 1: diagonal front
        { x: 137, y: 40, width: 33, height: 34 },   // 2: front
        { x: 181, y: 40, width: 28, height: 32 },   // 3: back
        { x: 108, y: 90, width: 43, height: 42 },  // 4: top (for back wall)
        { x: 171, y: 89, width: 24, height: 38 },  // 5: bottom (for front wall)
        { x: 25, y: 89, width: 34, height: 28 }   // 6: empty shell
    ];

    private wall: Wall;
    private path: PathPoint[] = [];
    private goal: Vector | null = null;
    private baseSpeed: number = 0.03 * this.size;
    private wallOffset: number = this.size / 2;
    private moveVector: Vector = Vector.zero();
    private coveredAlgaePositions: Set<string> = new Set(); // Track algae positions we've covered
    private tank: Tank | null = null;
    private eatingCounter: number = 0; // Counter for eating algae, affects speed
    private goalReEvaluationChance: number = 0.002; // Very small chance to re-evaluate goal each frame

    constructor(size: number = 20) {
        const startWall = Snail.getRandomWall();
        const startPos = Snail.getRandomPositionOnWall(startWall, 5);
        super(new Position(startPos, new Vector(0,0,0), false), size);

        this.wall = startWall;
        this.wallOffset = 5;
        this.setNewGoal();
    }

    static loadSpritesheet(): void {
        Snail.spritesheet = loadImage('assets/snail_clear.png');
    }

    private static getRandomWall(): Wall {
        const walls: Wall[] = ['front', 'back', 'left', 'right', 'bottom'];
        return walls[Math.floor(random() * walls.length)];
    }

    private static getTankBounds() {
        return {
            minX: TANK_CONSTANTS.X,
            maxX: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH,
            minY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT,
            maxY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT,
            minZ: TANK_CONSTANTS.MIN_Z,
            maxZ: TANK_CONSTANTS.DEPTH
        };
    }

    private static getRandomPositionOnWall(wall: Wall, offset: number): Vector {
        const bounds = Snail.getTankBounds();

        switch (wall) {
            case 'front':
                return new Vector(
                    bounds.minX + random() * TANK_CONSTANTS.WIDTH,
                    bounds.minY + random() * (bounds.maxY - bounds.minY),
                    bounds.minZ + offset
                );
            case 'back':
                return new Vector(
                    bounds.minX + random() * TANK_CONSTANTS.WIDTH,
                    bounds.minY + random() * (bounds.maxY - bounds.minY),
                    bounds.maxZ - offset
                );
            case 'left':
                return new Vector(
                    bounds.minX + offset,
                    bounds.minY + random() * (bounds.maxY - bounds.minY),
                    bounds.minZ + random() * (bounds.maxZ - bounds.minZ)
                );
            case 'right':
                return new Vector(
                    bounds.maxX - offset,
                    bounds.minY + random() * (bounds.maxY - bounds.minY),
                    bounds.minZ + random() * (bounds.maxZ - bounds.minZ)
                );
            case 'bottom':
                return new Vector(
                    bounds.minX + random() * TANK_CONSTANTS.WIDTH,
                    bounds.maxY - offset,
                    bounds.minZ + random() * (bounds.maxZ - bounds.minZ)
                );
        }
    }

    private setNewGoal(): void {
        if (!this.tank) {
            // Fallback to random goal if no tank access
            const goalWall = Snail.getRandomWall();
            this.goal = Snail.getRandomPositionOnWall(goalWall, this.wallOffset);
        } else {
            // TOP PRIORITY: Check for settled food at the bottom
            const settledFood = this.findNearestSettledFood();
            if (settledFood) {
                // Found settled food, set goal to food position
                this.goal = new Vector(settledFood.position.x, settledFood.position.y, settledFood.position.z);
            } else {
                // Try to find algae target if no settled food
                const pos = this.position.value;
                const algaeTarget = this.tank.algae.findBestAlgaeTarget(pos.x, pos.y, pos.z, 300);
                
                if (algaeTarget) {
                    // Found algae target, set goal to algae position
                    this.goal = new Vector(algaeTarget.x, algaeTarget.y, algaeTarget.z);
                    
                    // If we're already close to this goal, look for local algae clusters
                    if (this.goal.distanceTo(pos) <= 20) {
                        const localCluster = this.findLocalAlgaeCluster(pos);
                        if (localCluster) {
                            // Clamp the local cluster position to the current wall
                            this.goal = this.clampPositionToWallPosition(localCluster);
                        }
                    }
                } else {
                    // No algae found, set random goal
                    const goalWall = Snail.getRandomWall();
                    this.goal = Snail.getRandomPositionOnWall(goalWall, this.wallOffset);
                }
            }
        }

        // Check if the goal is too close to current position (projected to current wall)
        const projectedDistance = this.getProjectedDistanceToGoal();
        if (projectedDistance < 5) {
            // Goal is too close, find a better one that's at least 40 units away
            this.goal = this.findDistantGoal();
        }

        this.path = this.generatePath(this.position.value, this.goal!);
    }

    private clampPositionToWallPosition(pos: Vector): Vector {
        const bounds = Snail.getTankBounds();
        const clampedPos = pos.copy();

        // Clamp to tank bounds first
        clampedPos.x = Math.max(bounds.minX, Math.min(bounds.maxX, clampedPos.x));
        clampedPos.y = Math.max(bounds.minY, Math.min(bounds.maxY, clampedPos.y));
        clampedPos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, clampedPos.z));

        // Then clamp to current wall
        switch (this.wall) {
            case 'front':
                clampedPos.z = bounds.minZ + this.wallOffset;
                break;
            case 'back':
                clampedPos.z = bounds.maxZ - this.wallOffset;
                break;
            case 'left':
                clampedPos.x = bounds.minX + this.wallOffset;
                break;
            case 'right':
                clampedPos.x = bounds.maxX - this.wallOffset;
                break;
            case 'bottom':
                clampedPos.y = bounds.maxY - this.wallOffset;
                break;
        }

        return clampedPos;
    }

    private getProjectedDistanceToGoal(): number {
        if (!this.goal) return 0;
        
        const pos = this.position.value;
        const toGoal = this.goal.copy().subtractInPlace(pos);

        let projectedToGoal: Vector;
        switch (this.wall) {
            case 'front':
            case 'back':
                projectedToGoal = new Vector(toGoal.x, toGoal.y, 0);
                break;
            case 'left':
            case 'right':
                projectedToGoal = new Vector(0, toGoal.y, toGoal.z);
                break;
            case 'bottom':
                projectedToGoal = new Vector(toGoal.x, 0, toGoal.z);
                break;
        }

        return projectedToGoal.magnitude();
    }

    private findDistantGoal(): Vector {
        const pos = this.position.value;
        const bounds = Snail.getTankBounds();
        const minDistance = 40;
        let bestGoal: Vector | null = null;
        let bestScore = -Infinity;

        // Try to find algae targets that are far enough away
        if (this.tank) {
            // Look for algae targets in a larger radius
            const algaeTarget = this.tank.algae.findBestAlgaeTarget(pos.x, pos.y, pos.z, 500);
            if (algaeTarget) {
                const candidateGoal = new Vector(algaeTarget.x, algaeTarget.y, algaeTarget.z);
                const projectedDistance = this.getProjectedDistanceToGoal();
                if (projectedDistance >= minDistance) {
                    return candidateGoal;
                }
            }
        }

        // If no suitable algae target, try random positions on different walls
        const walls: Wall[] = ['front', 'back', 'left', 'right', 'bottom'];
        const shuffledWalls = walls.sort(() => random() - 0.5); // Shuffle walls

        for (const wall of shuffledWalls) {
            // Try multiple random positions on this wall
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidateGoal = Snail.getRandomPositionOnWall(wall, this.wallOffset);
                
                // Calculate projected distance to this goal
                const toGoal = candidateGoal.copy().subtractInPlace(pos);
                let projectedToGoal: Vector;
                
                switch (this.wall) {
                    case 'front':
                    case 'back':
                        projectedToGoal = new Vector(toGoal.x, toGoal.y, 0);
                        break;
                    case 'left':
                    case 'right':
                        projectedToGoal = new Vector(0, toGoal.y, toGoal.z);
                        break;
                    case 'bottom':
                        projectedToGoal = new Vector(toGoal.x, 0, toGoal.z);
                        break;
                }
                
                const projectedDistance = projectedToGoal.magnitude();
                
                if (projectedDistance >= minDistance) {
                    // Score based on distance (prefer farther goals) and wall preference
                    const distanceScore = projectedDistance;
                    const wallScore = wall === this.wall ? 0 : 50; // Bonus for different wall
                    const totalScore = distanceScore + wallScore;
                    
                    if (totalScore > bestScore) {
                        bestScore = totalScore;
                        bestGoal = candidateGoal;
                    }
                }
            }
        }

        // If we found a suitable goal, return it
        if (bestGoal) {
            return bestGoal;
        }

        // Fallback: return a position that's definitely far enough away on the current wall
        let fallbackGoal: Vector;
        
        switch (this.wall) {
            case 'front':
                fallbackGoal = new Vector(
                    pos.x + (random() > 0.5 ? minDistance : -minDistance),
                    pos.y + (random() > 0.5 ? minDistance : -minDistance),
                    bounds.minZ + this.wallOffset
                );
                break;
            case 'back':
                fallbackGoal = new Vector(
                    pos.x + (random() > 0.5 ? minDistance : -minDistance),
                    pos.y + (random() > 0.5 ? minDistance : -minDistance),
                    bounds.maxZ - this.wallOffset
                );
                break;
            case 'left':
                fallbackGoal = new Vector(
                    bounds.minX + this.wallOffset,
                    pos.y + (random() > 0.5 ? minDistance : -minDistance),
                    pos.z + (random() > 0.5 ? minDistance : -minDistance)
                );
                break;
            case 'right':
                fallbackGoal = new Vector(
                    bounds.maxX - this.wallOffset,
                    pos.y + (random() > 0.5 ? minDistance : -minDistance),
                    pos.z + (random() > 0.5 ? minDistance : -minDistance)
                );
                break;
            case 'bottom':
                fallbackGoal = new Vector(
                    pos.x + (random() > 0.5 ? minDistance : -minDistance),
                    bounds.maxY - this.wallOffset,
                    pos.z + (random() > 0.5 ? minDistance : -minDistance)
                );
                break;
        }

        // Clamp the fallback goal to tank bounds
        fallbackGoal.x = Math.max(bounds.minX, Math.min(bounds.maxX, fallbackGoal.x));
        fallbackGoal.y = Math.max(bounds.minY, Math.min(bounds.maxY, fallbackGoal.y));
        fallbackGoal.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, fallbackGoal.z));

        return fallbackGoal;
    }

    private findNearestSettledFood(): Food | null {
        if (!this.tank) return null;
        
        const pos = this.position.value;
        let nearestFood: Food | null = null;
        let nearestDistance = Infinity;
        
        // Look through all food in the tank
        for (const food of this.tank.food) {
            // Only consider settled food
            if (food.settled) {
                const distance = pos.distanceTo(food.position.value);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestFood = food;
                }
            }
        }
        
        return nearestFood;
    }

    private findLocalAlgaeCluster(center: Vector): Vector | null {
        if (!this.tank || this.wall === 'bottom') return null;
        
        const searchRadius = 15; // 30x30 square = 15 pixel radius
        const gridSize = 4; // Algae square size
        const clusterMap = new Map<string, { x: number, y: number, z: number, strength: number, count: number }>();
        
        // Scan 30x30 area around snail
        for (let dx = -searchRadius; dx <= searchRadius; dx += gridSize) {
            for (let dy = -searchRadius; dy <= searchRadius; dy += gridSize) {
                for (let dz = -searchRadius; dz <= searchRadius; dz += gridSize) {
                    const checkPos = new Vector(
                        center.x + dx,
                        center.y + dy,
                        center.z + dz
                    );
                    
                    const algaeLevel = this.tank.algae.getAlgaeLevel(this.wall, checkPos.x, checkPos.y, checkPos.z);
                    if (algaeLevel > 0) {
                        // Group into 8x8 pixel clusters for performance
                        const clusterSize = 8;
                        const clusterX = Math.floor(checkPos.x / clusterSize) * clusterSize;
                        const clusterY = Math.floor(checkPos.y / clusterSize) * clusterSize;
                        const clusterZ = Math.floor(checkPos.z / clusterSize) * clusterSize;
                        const clusterKey = `${clusterX}-${clusterY}-${clusterZ}`;
                        
                        if (clusterMap.has(clusterKey)) {
                            const cluster = clusterMap.get(clusterKey)!;
                            cluster.strength += algaeLevel;
                            cluster.count++;
                            // Update center to weighted average
                            cluster.x = (cluster.x * (cluster.count - 1) + checkPos.x) / cluster.count;
                            cluster.y = (cluster.y * (cluster.count - 1) + checkPos.y) / cluster.count;
                            cluster.z = (cluster.z * (cluster.count - 1) + checkPos.z) / cluster.count;
                        } else {
                            clusterMap.set(clusterKey, {
                                x: checkPos.x,
                                y: checkPos.y,
                                z: checkPos.z,
                                strength: algaeLevel,
                                count: 1
                            });
                        }
                    }
                }
            }
        }
        
        // Find the strongest cluster
        let bestCluster: { x: number, y: number, z: number, strength: number, count: number } | null = null;
        let bestScore = 0;
        
        for (const cluster of clusterMap.values()) {
            // Score based on strength and count
            const score = cluster.strength * cluster.count;
            if (score > bestScore) {
                bestScore = score;
                bestCluster = cluster;
            }
        }
        
        if (bestCluster) {
            return new Vector(bestCluster.x, bestCluster.y, bestCluster.z);
        }
        
        return null;
    }

    private generatePath(startPos: Vector, endPos: Vector): PathPoint[] {
        const startWall = this.getWallFromPosition(startPos);
        const endWall = this.getWallFromPosition(endPos);

        if (startWall === endWall) {
            return [{ position: endPos, wall: endWall }];
        }

        const adjacentWalls = this.getAdjacentWalls(startWall);
        if (adjacentWalls.includes(endWall)) {
            const edgePoint = this.getEdgeIntersection(startPos, endPos, startWall, endWall);
            return [
                { position: edgePoint, wall: endWall },
                { position: endPos, wall: endWall }
            ];
        }

        const oppositeWall = this.getOppositeWall(startWall);
        if (endWall === oppositeWall) {
            const possiblePaths: PathPoint[][] = [];

            for (const intermediateWall of adjacentWalls) {
                if (intermediateWall !== 'bottom') {
                    // Path through a side wall
                    const point1 = this.getEdgeIntersection(startPos, endPos, startWall, intermediateWall);
                    const point2 = this.getEdgeIntersection(point1, endPos, intermediateWall, endWall);
                    possiblePaths.push([
                        { position: point1, wall: intermediateWall },
                        { position: point2, wall: endWall },
                        { position: endPos, wall: endWall }
                    ]);
                } else if (startWall !== 'bottom' && endWall !== 'bottom') {
                    // Path through the bottom
                    const point1 = this.getEdgeIntersection(startPos, endPos, startWall, 'bottom');
                    const point2 = this.getEdgeIntersection(point1, endPos, 'bottom', endWall);
                    possiblePaths.push([
                        { position: point1, wall: 'bottom' },
                        { position: point2, wall: endWall },
                        { position: endPos, wall: endWall }
                    ]);
                }
            }

            let shortestPath: PathPoint[] = [];
            let shortestDistance = Infinity;

            for (const path of possiblePaths) {
                const distance = this.getPathLength(startPos, path.map(p => p.position));
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    shortestPath = path;
                }
            }
            return shortestPath;
        }
        
        return [{ position: endPos, wall: endWall }]; // Fallback
    }

    private getPathLength(startPos: Vector, path: Vector[]): number {
        let totalDistance = 0;
        let lastPos = startPos;
        for (const point of path) {
            totalDistance += lastPos.distanceTo(point);
            lastPos = point;
        }
        return totalDistance;
    }

    private getEdgeIntersection(startPos: Vector, endPos: Vector, startWall: Wall, endWall: Wall): Vector {
        const bounds = Snail.getTankBounds();
        
        // Calculate the intersection point on the shared edge between two walls
        switch (`${startWall}-${endWall}`) {
            // Front wall transitions
            case 'front-left':
                return new Vector(bounds.minX + this.wallOffset, startPos.y, bounds.minZ + this.wallOffset);
            case 'front-right':
                return new Vector(bounds.maxX - this.wallOffset, startPos.y, bounds.minZ + this.wallOffset);
            case 'front-bottom':
                return new Vector(startPos.x, bounds.maxY - this.wallOffset, bounds.minZ + this.wallOffset);
            
            // Back wall transitions
            case 'back-left':
                return new Vector(bounds.minX + this.wallOffset, startPos.y, bounds.maxZ - this.wallOffset);
            case 'back-right':
                return new Vector(bounds.maxX - this.wallOffset, startPos.y, bounds.maxZ - this.wallOffset);
            case 'back-bottom':
                return new Vector(startPos.x, bounds.maxY - this.wallOffset, bounds.maxZ - this.wallOffset);
            
            // Left wall transitions
            case 'left-front':
                return new Vector(bounds.minX + this.wallOffset, startPos.y, bounds.minZ + this.wallOffset);
            case 'left-back':
                return new Vector(bounds.minX + this.wallOffset, startPos.y, bounds.maxZ - this.wallOffset);
            case 'left-bottom':
                return new Vector(bounds.minX + this.wallOffset, bounds.maxY - this.wallOffset, startPos.z);
            
            // Right wall transitions
            case 'right-front':
                return new Vector(bounds.maxX - this.wallOffset, startPos.y, bounds.minZ + this.wallOffset);
            case 'right-back':
                return new Vector(bounds.maxX - this.wallOffset, startPos.y, bounds.maxZ - this.wallOffset);
            case 'right-bottom':
                return new Vector(bounds.maxX - this.wallOffset, bounds.maxY - this.wallOffset, startPos.z);
            
            // Bottom wall transitions
            case 'bottom-front':
                return new Vector(startPos.x, bounds.maxY - this.wallOffset, bounds.minZ + this.wallOffset);
            case 'bottom-back':
                return new Vector(startPos.x, bounds.maxY - this.wallOffset, bounds.maxZ - this.wallOffset);
            case 'bottom-left':
                return new Vector(bounds.minX + this.wallOffset, bounds.maxY - this.wallOffset, startPos.z);
            case 'bottom-right':
                return new Vector(bounds.maxX - this.wallOffset, bounds.maxY - this.wallOffset, startPos.z);
            
            default:
                return startPos.copy(); // Fallback
        }
    }

    private getOppositeWall(wall: Wall): Wall | null {
        switch (wall) {
            case 'front': return 'back';
            case 'back': return 'front';
            case 'left': return 'right';
            case 'right': return 'left';
            default: return null;
        }
    }

    update(inhabitants: Inhabitant[]): void {
        if (this.path.length === 0) {
            this.setNewGoal();
            return;
        }

        // Get tank reference to access algae and food
        if (!this.tank) {
            this.tank = this.getTank(inhabitants);
        }
        if (this.tank) {
            this.handleAlgaeInteraction(this.tank);
            this.handleFoodInteraction(this.tank);
        }

        // Decrease eating counter by 1 each frame (minimum 0)
        this.eatingCounter = Math.max(0, this.eatingCounter - 1);

        // Very small chance to re-evaluate goal each frame
        if (Math.random() < this.goalReEvaluationChance) {
            this.setNewGoal();
            return;
        }
        
        const currentTarget = this.path[0];
        const distanceToTarget = this.position.value.distanceTo(currentTarget.position);
        
        this.moveTowardsCurrentTarget();

        // Check if we've reached the current target
        if (distanceToTarget < 10) {
            // Remove the reached point from the path
            this.path.shift();
            
            if (this.path.length > 0) {
                // Switch to the new wall and set movement vector towards next target
                const nextTarget = this.path[0];
                if (currentTarget.wall !== this.wall) {
                    this.transitionToWall(currentTarget.wall);
                }
                this.setMovementVectorToTarget(nextTarget.position);
            } else {
                // Path completed, set new goal
                this.setNewGoal();
            }
        }

        this.clampPositionToWall();
    }

    private moveTowardsCurrentTarget(): void {
        if (this.path.length === 0) {
            this.moveVector = Vector.zero();
            return;
        }

        const currentTarget = this.path[0];
        this.setMovementVectorToTarget(currentTarget.position);
        
        this.position.value.addInPlace(this.moveVector);
    }

    private setMovementVectorToTarget(target: Vector): void {
        const toTarget = target.copy().subtractInPlace(this.position.value);

        let projectedToTarget: Vector;
        switch (this.wall) {
            case 'front':
            case 'back':
                projectedToTarget = new Vector(toTarget.x, toTarget.y, 0);
                break;
            case 'left':
            case 'right':
                projectedToTarget = new Vector(0, toTarget.y, toTarget.z);
                break;
            case 'bottom':
                projectedToTarget = new Vector(toTarget.x, 0, toTarget.z);
                break;
        }

        const projectedDistance = projectedToTarget.magnitude();
        if (projectedDistance > 0) {
            const currentSpeed = this.getCurrentSpeed();
            const moveDistance = Math.min(currentSpeed, projectedDistance);
            this.moveVector = projectedToTarget.normalize().multiplyInPlace(moveDistance);
        } else {
            this.moveVector = Vector.zero();
        }
    }

    private transitionToWall(newWall: Wall): void {
        const oldWall = this.wall;
        this.wall = newWall;
        
        // Transform the current velocity vector for the new wall orientation
        const v = this.moveVector.copy();
        switch (`${oldWall}-${newWall}`) {
            // Front to sides
            case 'front-left': this.moveVector = new Vector(0, v.y, -v.x); break;
            case 'front-right': this.moveVector = new Vector(0, v.y, v.x); break;
            case 'front-bottom': this.moveVector = new Vector(v.x, 0, -v.y); break;
            
            // Back to sides
            case 'back-left': this.moveVector = new Vector(0, v.y, v.x); break;
            case 'back-right': this.moveVector = new Vector(0, v.y, -v.x); break;
            case 'back-bottom': this.moveVector = new Vector(v.x, 0, v.y); break;

            // Left to sides
            case 'left-front': this.moveVector = new Vector(-v.z, v.y, 0); break;
            case 'left-back': this.moveVector = new Vector(v.z, v.y, 0); break;
            case 'left-bottom': this.moveVector = new Vector(v.z, 0, -v.y); break;

            // Right to sides
            case 'right-front': this.moveVector = new Vector(v.z, v.y, 0); break;
            case 'right-back': this.moveVector = new Vector(-v.z, v.y, 0); break;
            case 'right-bottom': this.moveVector = new Vector(-v.z, 0, -v.y); break;

            // Bottom to sides
            case 'bottom-front': this.moveVector = new Vector(v.x, -v.z, 0); break;
            case 'bottom-back': this.moveVector = new Vector(v.x, v.z, 0); break;
            case 'bottom-left': this.moveVector = new Vector(0, v.z, v.x); break;
            case 'bottom-right': this.moveVector = new Vector(0, v.z, -v.x); break;
            
            default:
                // If no specific transformation, reset movement vector
                this.moveVector = Vector.zero();
                break;
        }
        
        this.clampPositionToWall();
    }

    private getWallFromPosition(pos: Vector): Wall {
        const bounds = Snail.getTankBounds();
        const dists = {
            front: Math.abs(pos.z - bounds.minZ),
            back: Math.abs(pos.z - bounds.maxZ),
            left: Math.abs(pos.x - bounds.minX),
            right: Math.abs(pos.x - bounds.maxX),
            bottom: Math.abs(pos.y - bounds.maxY)
        };

        let closestWall: Wall = 'front';
        let minDist = dists.front;

        for (const [wall, dist] of Object.entries(dists)) {
            if (dist < minDist) {
                minDist = dist;
                closestWall = wall as Wall;
            }
        }
        return closestWall;
    }

    private getAdjacentWalls(wall: Wall): Wall[] {
        const connections: { [key in Wall]: Wall[] } = {
            'front': ['left', 'right', 'bottom'],
            'back': ['left', 'right', 'bottom'],
            'left': ['front', 'back', 'bottom'],
            'right': ['front', 'back', 'bottom'],
            'bottom': ['front', 'back', 'left', 'right']
        };
        return connections[wall];
    }

    private clampPositionToWall() {
        const bounds = Snail.getTankBounds();
        const pos = this.position.value;

        pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
        pos.y = Math.max(bounds.minY, Math.min(bounds.maxY, pos.y));
        pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));

        switch (this.wall) {
            case 'front':
                pos.z = bounds.minZ + this.wallOffset;
                break;
            case 'back':
                pos.z = bounds.maxZ - this.wallOffset;
                break;
            case 'left':
                pos.x = bounds.minX + this.wallOffset;
                break;
            case 'right':
                pos.x = bounds.maxX - this.wallOffset;
                break;
            case 'bottom':
                pos.y = bounds.maxY - this.wallOffset;
                break;
        }
    }

    private getTank(inhabitants: Inhabitant[]): Tank | null {
        // Find tank by looking for it in the inhabitants array or by accessing it through context
        // This is a bit of a hack, but we need access to the tank
        for (const inhabitant of inhabitants) {
            if ((inhabitant as any).tank) {
                return (inhabitant as any).tank;
            }
        }
        return null;
    }

    private handleAlgaeInteraction(tank: Tank): void {
        // Only interact with algae on walls that support it (not bottom)
        if (this.wall === 'bottom') return;

        const pos = this.position.value;
        const searchRadius = this.size / 3;
        
        // Check for algae within radius around snail's center
        const algaePositionsToCheck = this.getAlgaePositionsInRadius(pos, searchRadius);
        
        for (const checkPos of algaePositionsToCheck) {
            const algaeLevel = tank.algae.getAlgaeLevel(this.wall, checkPos.x, checkPos.y, checkPos.z);
            
            if (algaeLevel > 0) {
                // Create a unique key for this algae position based on grid coordinates
                const algaeKey = `${this.wall}-${Math.floor(checkPos.x/4)}-${Math.floor(checkPos.y/4)}-${Math.floor(checkPos.z/4)}`;
                
                // If we haven't covered this algae square yet, mark it as covered
                if (!this.coveredAlgaePositions.has(algaeKey)) {
                    this.coveredAlgaePositions.add(algaeKey);
                } else {
                    // We've been on this algae square for multiple frames, eat it
                    tank.algae.removeAlgae(this.wall, checkPos.x, checkPos.y, checkPos.z);
                    this.coveredAlgaePositions.delete(algaeKey);
                    
                    // Increase eating counter by algae level (max 200)
                    this.eatingCounter = Math.min(200, this.eatingCounter + algaeLevel * 3);
                }
            }
        }
    }

    private handleFoodInteraction(tank: Tank): void {
        const pos = this.position.value;
        const searchRadius = this.size / 3;
        
        // Check for settled food within radius around snail's center
        for (const food of tank.food) {
            if (food.settled) {
                const distance = pos.distanceTo(food.position.value);
                if (distance <= searchRadius) {
                    // Eat the food and remove it from the tank
                    tank.removeFood(food);
                    
                    // Set eating counter to maximum (100)
                    this.eatingCounter = 100;
                    
                    // Only eat one food at a time
                    break;
                }
            }
        }
    }

    private getAlgaePositionsInRadius(center: Vector, radius: number): Vector[] {
        const positions: Vector[] = [];
        const gridSize = 4; // Algae square size
        
        // Calculate grid bounds to check
        const minX = center.x - radius;
        const maxX = center.x + radius;
        const minY = center.y - radius;
        const maxY = center.y + radius;
        const minZ = center.z - radius;
        const maxZ = center.z + radius;
        
        // Generate grid positions within the radius
        for (let x = Math.floor(minX / gridSize) * gridSize; x <= maxX; x += gridSize) {
            for (let y = Math.floor(minY / gridSize) * gridSize; y <= maxY; y += gridSize) {
                for (let z = Math.floor(minZ / gridSize) * gridSize; z <= maxZ; z += gridSize) {
                    const gridPos = new Vector(x, y, z);
                    
                    // Check if this grid position is within radius
                    if (center.distanceTo(gridPos) <= radius) {
                        positions.push(gridPos);
                    }
                }
            }
        }
        
        return positions;
    }

    private getCurrentSpeed(): number {
        // Speed = baseSpeed * (1 - eatingCounter/100)
        const speedMultiplier = 1 - Math.min(1, this.eatingCounter / 100);
        return this.baseSpeed * speedMultiplier;
    }

    private getSpriteIndexAndRotation(): { index: number; rotation: number; mirrored: boolean } {
        const delta = this.moveVector;
        
        // Handle front and back walls specially - use top/bottom sprites with rotation
        if (this.wall === 'front') {
            // Use bottom sprite (index 5) and rotate based on movement direction
            const angle = Math.atan2(delta.x, -delta.y); // Note: y is inverted for bottom view
            return { index: 5, rotation: angle, mirrored: false };
        }
        
        if (this.wall === 'back') {
            // Use top sprite (index 4) and rotate based on movement direction
            // Top sprite faces diagonal up-right at about 30 degrees from vertical, so add offset
            // Negate y-component to match tank coordinate system (up = negative y)
            const angle = Math.atan2(delta.x, -delta.y) - Math.PI / 6; // Subtract 30 degrees (π/6 radians) offset
            return { index: 4, rotation: angle, mirrored: false };
        }
        
        // For left, right, and bottom walls, use directional sprites
        const x = delta.x;
        const z = delta.z;
        const y = delta.y;
        
        // Calculate angle based on the primary movement components for this wall
        let angle: number;
        let angleX: number, angleY: number;
        
        switch (this.wall) {
            case 'left':
                angleX = -y; // z-component (left/right relative to wall)
                angleY = -z; // y-component (up/down)
                break;
            case 'right':
                angleX = y; // y-component (left/right relative to wall)
                angleY = -z; // z-component (up/down)
                break;
            case 'bottom':
                angleX = -x; // x-component (left/right)
                angleY = -z; // z-component (forward/back)
                break;
            default:
                angleX = 0;
                angleY = 0;
        }
        
        // Calculate angle in radians
        angle = Math.atan2(angleY, angleX);
        // Convert to degrees and normalize to 0-360
        const degrees = (angle * 180 / Math.PI + 360) % 360;
        
        // Map to sprites similar to fish logic, with 45-degree boundary between back and side
        // Use octant-based mapping for smoother transitions
        let spriteIndex: number;
        let mirrored: boolean;
        let baseRotation: number = 0;
        
        if (degrees >= 337.5 || degrees < 22.5) {
            spriteIndex = 0; mirrored = false; // left
        } else if (degrees >= 22.5 && degrees < 67.5) {
            spriteIndex = 1; mirrored = false; // diagonal front
        } else if (degrees >= 67.5 && degrees < 112.5) {
            spriteIndex = 2; mirrored = false; // front
        } else if (degrees >= 112.5 && degrees < 157.5) {
            spriteIndex = 1; mirrored = true; // diagonal front (mirrored for right)
        } else if (degrees >= 157.5 && degrees < 202.5) {
            spriteIndex = 0; mirrored = true; // left (mirrored for right)
        } else if (degrees >= 202.5 && degrees < 292.5) {
            spriteIndex = 3; mirrored = false; // back
        } else {
            // 292.5-337.5: back-left, use left sprite
            spriteIndex = 0; mirrored = false; // left
        }
        
        // Apply wall-specific rotation offsets
        if (this.wall === 'left') {
            // Rotate 90 degrees clockwise (+ π/2 radians)
            baseRotation = Math.PI / 2;
        } else if (this.wall === 'right') {
            // Rotate 90 degrees counterclockwise (- π/2 radians)
            baseRotation = -Math.PI / 2;
        }
        
        return { index: spriteIndex, rotation: baseRotation, mirrored: mirrored };
    }

    render(tank: Tank, _color?: p5.Color): void {
        if (!Snail.spritesheet) {
            // Fallback to circle rendering if spritesheet not loaded
            const relativeDepth = this.position.z / tank.depth;
            const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
            const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
            const depthScale = lerp(1, 0.7, relativeDepth);
            const renderSize = this.size * depthScale;

            push();
            fill(139, 69, 19, 255); // Brown color for snail
            noStroke();
            ellipse(renderX, renderY, renderSize, renderSize);
            pop();
            return;
        }

        // Use sprite rendering
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
        
        // Scale size based on depth
        const depthScale = lerp(1, 0.7, relativeDepth);
        const { index, rotation, mirrored } = this.getSpriteIndexAndRotation();
        const spriteConfig = Snail.SPRITE_CONFIGS[index];
        
        // Use height as the consistent scaling factor
        const MAX_SPRITE_HEIGHT = 32; // Height of sprites
        
        // Calculate scale based on the snail's size and the sprite height
        const scale_size = (this.size * depthScale) / MAX_SPRITE_HEIGHT;
        const spriteWidth = spriteConfig.width * scale_size;
        const spriteHeight = spriteConfig.height * scale_size;
        
        // Save current transformation state
        push();
        
        // Apply transformations in order: translate, rotate, scale
        translate(renderX, renderY);
        rotate(rotation);
        
        // Apply mirroring if needed
        if (mirrored) {
            scale(-1, 1);
        }
        
        // Draw the sprite centered at origin (which is now at the snail's position)
        image(
            Snail.spritesheet,
            -spriteWidth/2,
            -spriteHeight/2,
            spriteWidth,
            spriteHeight,
            spriteConfig.x,
            spriteConfig.y,
            spriteConfig.width,
            spriteConfig.height
        );
        
        // Restore the original transformation state
        pop();
    }
} 