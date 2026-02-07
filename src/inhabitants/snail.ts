import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';
import { Food } from './food.js';
import { Hunger } from '../factors/hunger.js';
import { EggClump } from './egg_clump.js';
import { getTankBounds } from '../constants.js';
import { Wall, WallPoint, WALL_CONFIG, world3DToWall2D, wall2DToWorld3D as sharedWall2DToWorld3D, wall2DToWorld3DVelocity as sharedWall2DVelocity, getWall2DBounds as sharedGetWall2DBounds, getOppositeWall, getAdjacentWalls } from '../wall-utils.js';

declare function push(): void;
declare function pop(): void;
declare function random(): number;
declare function image(img: p5.Image, x: number, y: number, w: number, h: number, sx: number, sy: number, sw: number, sh: number): void;
declare function loadImage(path: string): p5.Image;
declare function translate(x: number, y: number): void;
declare function rotate(angle: number): void;
declare function scale(x: number, y: number): void;
declare function tint(r: number, g: number, b: number, a?: number): void;
declare function tint(gray: number, alpha: number): void;
declare function noTint(): void;

declare namespace p5 {
  interface Color {}
  interface Image {}
}

interface SpriteConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Lifecycle timing (frames at 60fps)
const EGG_LAYING_FRAMES = 120;
const DEAD_FADE_FRAMES = 1800;
const SHELL_GRAVITY = 0.5;

// Reproduction & growth
const EGG_HUNGER_THRESHOLD = 0.30;
const EGG_MIN_SIZE = 15;
const EGG_CHANCE_PER_FRAME = 0.0005;
const STARVATION_DEATH_CHANCE = 0.1;
const POST_EGG_HUNGER_COST = 0.50;
const GROWTH_HUNGER_COST = 0.05;
const GROWTH_CHANCE_DIVISOR = 500;

// Movement & eating
const ACCEL_COEFFICIENT = 0.063;
const EATING_SPEED_THRESHOLD = 80;
const EATING_SPEED_REDUCTION = 0.85;
const MAX_EATING_COUNTER = 200;
const EATING_COUNTER_DECAY = 2.0;

// Navigation
const HOTSPOT_MAX_DISTANCE = 600;
const HOTSPOT_SCORE_OFFSET = 50;
const HOTSPOT_CLOSE_DISTANCE = 40;
const HOTSPOT_REGION_SIZE = 40;
const PRECISE_SQUARE_SIZE = 8;
const ALGAE_GRID_SIZE = 4;
const TARGET_REACH_MARGIN = 5;
const GOAL_COOLDOWN_FRAMES = 20;

// Hunger effects
const ALGAE_HUNGER_RATE = 0.005;
const FOOD_HUNGER_DECREASE = 0.05;
const FOOD_EATING_BOOST = 50;
const BASE_HUNGER_SIZE = 20;
const BASE_HUNGER_INCREASE_RATE = 0.0001;

// Rendering
const SNAIL_SPRITE_HEIGHT = 32;

type SnailLifeState = 'normal' | 'egg-laying' | 'dying' | 'shell' | 'dead';

export class Snail extends Inhabitant {
    static spritesheet: p5.Image | null = null;
    static readonly SPRITE_CONFIGS: SpriteConfig[] = [
        { x: 10, y: 40, width: 48, height: 34 },    // 0: left
        { x: 80, y: 40, width: 40, height: 34 },     // 1: diagonal front
        { x: 137, y: 40, width: 33, height: 34 },    // 2: front
        { x: 181, y: 40, width: 28, height: 32 },    // 3: back
        { x: 108, y: 90, width: 43, height: 42 },    // 4: top (for back wall)
        { x: 171, y: 89, width: 24, height: 38 },    // 5: bottom (for front wall)
        { x: 25, y: 89, width: 34, height: 28 }      // 6: empty shell
    ];

    private wall: Wall;
    private path: WallPoint[] = [];
    private goal: WallPoint | null = null;
    private wallOffset: number = this.size / 2;
    private coveredAlgaePositions: Set<string> = new Set();
    private tank: Tank | null = null;
    private bounds: { min: Vector, max: Vector } = getTankBounds();
    private eatingCounter: number = 0;
    private readonly goalReEvaluationChance: number = 0.003;
    private readonly maxSize: number = 50;
    private frameCounter: number = 0;
    private readonly ALGAE_INTERACTION_INTERVAL: number = 5;
    private lastTransitionFrame: number = 0;
    private readonly TRANSITION_COOLDOWN: number = 10;
    private lastGoalSetFrame: number = 0;

    private hunger: Hunger;
    private lifeState: SnailLifeState = 'normal';
    private lifeStateCounter: number = 0;
    private canSetGoals: boolean = true;
    private opacity: number = 255;
    public readonly id: string;
    
    private shellSettled: boolean = false;

    constructor(size: number = 20, initialPosition?: Vector, initialWall?: Wall, initialHunger?: number) {
        let startWall: Wall;
        let startPos: Vector;
        
        if (initialPosition && initialWall) {
            startWall = initialWall;
            startPos = initialPosition;
        } else {
            startWall = 'back';
            startPos = new Vector(0, 0, 0);
        }
        
        super(new Position(startPos, new Vector(0,0,0), false, 0.80), size);

        if (!initialPosition || !initialWall) {
            startWall = this.getRandomWall();
            startPos = this.getRandomPositionOnWall(startWall, 5);
            this.position.value = startPos;
        }
        
        this.wall = startWall;
        
        const hungerValue = initialHunger !== undefined ? initialHunger : 0.2;
        this.hunger = new Hunger(hungerValue, 0, BASE_HUNGER_INCREASE_RATE * (size / BASE_HUNGER_SIZE));
        this.id = Math.random().toString(36).substring(2, 8);
        
        this.setNewGoal();
    }

    static loadSpritesheet(): void {
        Snail.spritesheet = loadImage('assets/snail_clear.png');
    }

    private getRandomWall(): Wall {
        const walls: Wall[] = ['front', 'back', 'left', 'right', 'bottom'];
        return walls[Math.floor(random() * walls.length)];
    }

    private getRandomPositionOnWall(wall: Wall, offset: number): Vector {
        const bounds = this.bounds;
        const pos = new Vector(
            bounds.min.x + random() * (bounds.max.x - bounds.min.x),
            bounds.min.y + random() * (bounds.max.y - bounds.min.y),
            bounds.min.z + random() * (bounds.max.z - bounds.min.z)
        );
        const cfg = WALL_CONFIG[wall];
        pos[cfg.fixedAxis] = cfg.fixedAtMax
            ? bounds.max[cfg.fixedAxis] - offset
            : bounds.min[cfg.fixedAxis] + offset;
        return pos;
    }

    private wallDistance(pos1: Vector, wall1: Wall, pos2: Vector, wall2: Wall): number {
        if (wall1 === wall2) {
            const pos1_2D = world3DToWall2D(pos1, wall1);
            const pos2_2D = world3DToWall2D(pos2, wall2);
            const dx = pos1_2D.x - pos2_2D.x;
            const dy = pos1_2D.y - pos2_2D.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        return pos1.distanceTo(pos2);
    }

    private setNewGoal(): void {
        this.lastGoalSetFrame = this.frameCounter;

        const settledFood = this.findNearestSettledFood();
        if (settledFood) {
            const foodPos = settledFood.position.value;
            const food2D = world3DToWall2D(foodPos, 'bottom');
            this.goal = { wall: 'bottom', x: food2D.x, y: food2D.y };
        } else {
             const bestAlgaeTarget = this.findBestAlgaeTarget();
             if (bestAlgaeTarget) {
                 const bestTargetPos = sharedWall2DToWorld3D(bestAlgaeTarget, this.wallOffset);
                 const distanceToBestTarget = this.wallDistance(this.position.value, this.wall, bestTargetPos, bestAlgaeTarget.wall);
                 
                 if (distanceToBestTarget <= HOTSPOT_CLOSE_DISTANCE) {
                     const preciseGoal = this.findPreciseAlgaeGoal(bestAlgaeTarget);
                     this.goal = preciseGoal;
                 } else {
                    this.goal = bestAlgaeTarget;
                 }
             } else {
                 this.setRandomGoal();
                 return;
             }
        }

        if (this.goal) {
            this.goal = this.clampGoalToWallBounds(this.goal);
            this.path = this.generatePath(this.goal);
        }
    }

    private clampGoalToWallBounds(goal: WallPoint): WallPoint {
        const b = sharedGetWall2DBounds(goal.wall);
        return {
            wall: goal.wall,
            x: Math.max(b.minX, Math.min(b.maxX, goal.x)),
            y: Math.max(b.minY, Math.min(b.maxY, goal.y))
        };
    }

    private findNearestSettledFood(): Food | null {
        if (!this.tank) return null;
        
        const pos = this.position.value;
        let nearestFood: Food | null = null;
        let nearestDistance = Infinity;
        
        for (const food of this.tank.food) {
            if (food.settled) {
                const distance = this.wallDistance(pos, this.wall, food.position.value, 'bottom');
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestFood = food;
                }
            }
        }
        
        return nearestFood;
    }

    private findBestAlgaeTarget(): WallPoint | null {
        if (!this.tank || !this.tank.algae) return null;
        
        this.tank.algae.requestHotspotUpdate();
        
        const pos = this.position.value;
        let bestTarget: WallPoint | null = null;
        let bestScore = -1;

        // Smaller snails sense algae over a shorter range and prioritize nearness more
        const sizeFraction = this.size / this.maxSize;
        const sensingRange = HOTSPOT_MAX_DISTANCE * (0.3 + 0.7 * sizeFraction);
        const distancePenalty = HOTSPOT_SCORE_OFFSET * (1 + 2 * (1 - sizeFraction));

        for (const hotspot of this.tank.algae.getAlgaeHotspots()) {
            const hotspotPos = sharedWall2DToWorld3D({ wall: hotspot.wall, x: hotspot.centerX, y: hotspot.centerY }, this.wallOffset);
            const distance = this.wallDistance(pos, this.wall, hotspotPos, hotspot.wall);
            
            if (distance > sensingRange) continue;

            const score = hotspot.strength / (distance + distancePenalty);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = { wall: hotspot.wall, x: hotspot.centerX, y: hotspot.centerY };
            }
        }

        return bestTarget;
    }

    private findPreciseAlgaeGoal(hotspotGoal: WallPoint): WallPoint | null {
        if (!this.tank || !this.tank.algae) return null;
        if (hotspotGoal.wall === 'bottom') return null;
        
        // Both left/right and front/back walls use the same WallPoint coordinate convention
        const regionCenterX = hotspotGoal.x;
        const regionCenterY = hotspotGoal.y;
        
        const halfRegion = HOTSPOT_REGION_SIZE / 2;
        const regionMinX = regionCenterX - halfRegion;
        const regionMaxX = regionCenterX + halfRegion;
        const regionMinY = regionCenterY - halfRegion;
        const regionMaxY = regionCenterY + halfRegion;
        
        let bestSquare: { x: number, y: number, strength: number } | null = null;
        let bestStrength = 0;
        
        for (let squareX = regionMinX; squareX < regionMaxX; squareX += PRECISE_SQUARE_SIZE) {
            for (let squareY = regionMinY; squareY < regionMaxY; squareY += PRECISE_SQUARE_SIZE) {
                const squareStrength = this.calculateSquareAlgaeStrength(
                    hotspotGoal.wall as 'front' | 'back' | 'left' | 'right',
                    squareX, squareY, PRECISE_SQUARE_SIZE
                );
                
                if (squareStrength > bestStrength) {
                    bestStrength = squareStrength;
                    bestSquare = {
                        x: squareX + PRECISE_SQUARE_SIZE / 2,
                        y: squareY + PRECISE_SQUARE_SIZE / 2,
                        strength: squareStrength
                    };
                }
            }
        }
        
        if (bestSquare && bestSquare.strength > 0) {
            return { wall: hotspotGoal.wall, x: bestSquare.x, y: bestSquare.y };
        }
        return null;
    }

    private calculateSquareAlgaeStrength(wall: 'front' | 'back' | 'left' | 'right', squareX: number, squareY: number, squareSize: number): number {
        if (!this.tank || !this.tank.algae) return 0;
        const centerX = squareX + (squareSize / 2);
        const centerY = squareY + (squareSize / 2);
        return this.tank.algae.getAlgaeLevel(wall, centerX, centerY);
    }

    private generatePath(goal: WallPoint): WallPoint[] {
        const startPos2D = world3DToWall2D(this.position.value, this.wall);
        const startWall = this.wall;
        const targetWall = goal.wall;

        const oppositeWall = getOppositeWall(startWall);
        if (targetWall !== oppositeWall) {
            return [this.clampGoalToWallBounds({ wall: targetWall, x: goal.x, y: goal.y })];
        }
        return this.generatePathThroughInterveningWall(startWall, targetWall, startPos2D, goal);
    }


    private generatePathThroughInterveningWall(startWall: Wall, targetWall: Wall, startPos2D: { x: number, y: number }, goal: WallPoint): WallPoint[] {
        const adjacentWalls = getAdjacentWalls(startWall);
        let bestWall: Wall = adjacentWalls[0];
        let shortestDistance = Infinity;
        let bestMidpoint: { x: number, y: number } = { x: 0, y: 0 };

        for (const interveningWall of adjacentWalls) {
            const result = this.calculateSimplePathDistance(startWall, interveningWall, targetWall, startPos2D, goal);
            if (result.distance < shortestDistance) {
                shortestDistance = result.distance;
                bestWall = interveningWall;
                bestMidpoint = result.wallPosition;
            }
        }
        
        return [
            this.clampGoalToWallBounds({ wall: bestWall, x: bestMidpoint.x, y: bestMidpoint.y }),
            this.clampGoalToWallBounds({ wall: targetWall, x: goal.x, y: goal.y })
        ];
    }

    private calculateSimplePathDistance(startWall: Wall, interveningWall: Wall, targetWall: Wall, startPos2D: { x: number, y: number }, goal: WallPoint): { distance: number, wallPosition: { x: number, y: number } } {
        const bounds = this.bounds;
        
        const cfg = WALL_CONFIG[interveningWall];
        const boundary = cfg.fixedAtMax ? bounds.max[cfg.fixedAxis] : bounds.min[cfg.fixedAxis];
        // Side walls measure distance along 2D x; bottom measures along 2D y
        const distCoord = interveningWall === 'bottom' ? 'y' : 'x';
        const otherCoord = interveningWall === 'bottom' ? 'x' : 'y';

        const distToInterveningWall = cfg.fixedAtMax
            ? boundary - startPos2D[distCoord]
            : startPos2D[distCoord] - boundary;
        const distFromGoalToInterveningWall = cfg.fixedAtMax
            ? boundary - goal[distCoord]
            : goal[distCoord] - boundary;
        const otherDimensionDiff = Math.abs(goal[otherCoord] - startPos2D[otherCoord]);
        const longerDist = Math.max(distToInterveningWall, distFromGoalToInterveningWall);
        const shorterDist = Math.min(distToInterveningWall, distFromGoalToInterveningWall);
        const pathDistance = Math.sqrt(longerDist ** 2 + otherDimensionDiff ** 2) + shorterDist;

        // Midpoint in the intervening wall's 2D space
        // Wall 2D mappings: front/back=(worldX,worldY), left/right=(worldZ,worldY), bottom=(worldX,worldZ)
        const startIsCloser = distToInterveningWall < distFromGoalToInterveningWall;
        let midX: number = 0;
        let midY: number = 0;

        switch (interveningWall) {
            case 'left':
            case 'right':
                midX = (bounds.min.z + bounds.max.z) / 2;
                midY = startIsCloser ? startPos2D.y : goal.y;
                break;
            case 'front':
            case 'back':
                midX = (bounds.min.x + bounds.max.x) / 2;
                midY = startIsCloser ? startPos2D.y : goal.y;
                break;
            case 'bottom':
                if (startWall === 'front' || startWall === 'back') {
                    // Front/back share worldX with bottom, cross in worldZ
                    midX = startIsCloser ? startPos2D.x : goal.x;
                    midY = (bounds.min.z + bounds.max.z) / 2;
                } else {
                    // Left/right share worldZ with bottom, cross in worldX
                    midX = (bounds.min.x + bounds.max.x) / 2;
                    midY = startIsCloser ? startPos2D.x : goal.x;
                }
                break;
        }

        return { distance: pathDistance, wallPosition: { x: midX, y: midY } };
    }

    update(inhabitants: Inhabitant[]): void {
        super.update(inhabitants);
        this.frameCounter++;
        this.hunger.update();
        this.updateLifeCycle(inhabitants);
        
        if (this.lifeState === 'egg-laying' || this.lifeState === 'dying' || this.lifeState === 'shell' || this.lifeState === 'dead') {
            return;
        }
        
        if (this.path.length === 0) {
            this.setNewGoal();
            return;
        }

        if (this.tank) {
            this.handleAlgaeInteraction(this.tank);
            this.handleFoodInteraction(this.tank);
        }

        this.eatingCounter = Math.max(0, this.eatingCounter - EATING_COUNTER_DECAY);

        const framesSinceTransition = this.frameCounter - this.lastTransitionFrame;
        const framesSinceGoal = this.frameCounter - this.lastGoalSetFrame;
        if (framesSinceTransition > this.TRANSITION_COOLDOWN * 3 && framesSinceGoal > GOAL_COOLDOWN_FRAMES && Math.random() < this.goalReEvaluationChance) {
            this.setNewGoal();
            return;
        }
        
        const currentTarget = this.path[0];
        const currentPos2D = world3DToWall2D(this.position.value, this.wall);
        
        let distanceToTarget = Infinity;
        if (this.wall === currentTarget.wall) {
            const dx = currentTarget.x - currentPos2D.x;
            const dy = currentTarget.y - currentPos2D.y;
            distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        }

        const framesSinceGoalSet = this.frameCounter - this.lastGoalSetFrame;
        if (framesSinceGoalSet > GOAL_COOLDOWN_FRAMES && distanceToTarget < (this.size / 2) + TARGET_REACH_MARGIN) {
            this.path.shift();
            if (this.path.length === 0) {
                this.setNewGoal();
            }
        }

        const didWallTransition = this.checkWallTransition();
        if (!didWallTransition) {
            this.moveTowardsCurrentTarget();
            this.clampPositionToWall();
        }
    }

    /** Acceleration scales with log(size); eating reduces speed via sqrt curve */
    private getAcceleration(): number {
        const baseAccel = ACCEL_COEFFICIENT * Math.log(this.size);
        const eatingFraction = Math.min(1, this.eatingCounter / EATING_SPEED_THRESHOLD);
        const eatingMultiplier = 1 - EATING_SPEED_REDUCTION * Math.sqrt(eatingFraction);
        return baseAccel * eatingMultiplier;
    }

    private moveTowardsCurrentTarget(): void {
        if (this.path.length === 0) return;

        const currentTarget = this.path[0];
        const currentPos2D = world3DToWall2D(this.position.value, this.wall);

        let dx: number, dy: number;
        if (this.wall === currentTarget.wall) {
            dx = currentTarget.x - currentPos2D.x;
            dy = currentTarget.y - currentPos2D.y;
        } else {
            const edgeTarget = this.getEdgeTarget2D(currentTarget);
            dx = edgeTarget.x - currentPos2D.x;
            dy = edgeTarget.y - currentPos2D.y;
        }

        const vector2D: WallPoint = { wall: this.wall, x: dx, y: dy };
        const acceleration = sharedWall2DVelocity(vector2D).normalize().multiply(this.getAcceleration());
        this.position.applyAcceleration(acceleration, 1);
    }

    /** Compute 2D edge target on the current wall when heading to a different wall.
     *  Placed on the connecting edge at the shared coordinate value. */
    private getEdgeTarget2D(target: WallPoint): { x: number; y: number } {
        const bounds = this.bounds;
        switch (`${this.wall}-${target.wall}`) {
            case 'front-left': case 'back-left':
                return { x: bounds.min.x, y: target.y };
            case 'front-right': case 'back-right':
                return { x: bounds.max.x, y: target.y };
            case 'front-bottom': case 'back-bottom':
                return { x: target.x, y: bounds.max.y };
            case 'left-front': case 'right-front':
                return { x: bounds.min.z, y: target.y };
            case 'left-back': case 'right-back':
                return { x: bounds.max.z, y: target.y };
            case 'left-bottom': case 'right-bottom':
                return { x: target.y, y: bounds.max.y };
            case 'bottom-front':
                return { x: target.x, y: bounds.min.z };
            case 'bottom-back':
                return { x: target.x, y: bounds.max.z };
            case 'bottom-left':
                return { x: bounds.min.x, y: target.x };
            case 'bottom-right':
                return { x: bounds.max.x, y: target.x };
            default:
                return { x: this.position.value.x, y: this.position.value.y };
        }
    }

    /** Only transitions when the next path target is on an adjacent wall AND we're at the connecting edge. */
    private checkWallTransition(): boolean {
        if (this.frameCounter - this.lastTransitionFrame < this.TRANSITION_COOLDOWN) return false;
        if (this.path.length === 0) return false;

        const targetWall = this.path[0].wall;
        if (targetWall === this.wall) return false;
        if (!getAdjacentWalls(this.wall).includes(targetWall)) return false;

        const bounds = this.bounds;
        const pos = this.position.value;
        const edgeThreshold = this.size / 2 + TARGET_REACH_MARGIN;

        let atEdge = false;
        switch (`${this.wall}-${targetWall}`) {
            case 'front-left': case 'back-left':
                atEdge = pos.x - bounds.min.x < edgeThreshold; break;
            case 'front-right': case 'back-right':
                atEdge = bounds.max.x - pos.x < edgeThreshold; break;
            case 'front-bottom': case 'back-bottom': case 'left-bottom': case 'right-bottom':
                atEdge = bounds.max.y - pos.y < edgeThreshold; break;
            case 'left-front': case 'right-front':
                atEdge = pos.z - bounds.min.z < edgeThreshold; break;
            case 'left-back': case 'right-back':
                atEdge = bounds.max.z - pos.z < edgeThreshold; break;
            case 'bottom-front':
                atEdge = pos.z - bounds.min.z < edgeThreshold; break;
            case 'bottom-back':
                atEdge = bounds.max.z - pos.z < edgeThreshold; break;
            case 'bottom-left':
                atEdge = pos.x - bounds.min.x < edgeThreshold; break;
            case 'bottom-right':
                atEdge = bounds.max.x - pos.x < edgeThreshold; break;
        }

        if (!atEdge) return false;

        this.wall = targetWall;
        this.lastTransitionFrame = this.frameCounter;
        this.position.delta = Vector.zero();
        this.position.ddelta = Vector.zero();
        this.clampPositionToWall();
        return true;
    }



    private clampPositionToWall() {
        const bounds = this.bounds;
        const pos = this.position.value;

        pos.x = Math.max(bounds.min.x, Math.min(bounds.max.x, pos.x));
        pos.y = Math.max(bounds.min.y, Math.min(bounds.max.y, pos.y));
        pos.z = Math.max(bounds.min.z, Math.min(bounds.max.z, pos.z));

        const cfg = WALL_CONFIG[this.wall];
        pos[cfg.fixedAxis] = cfg.fixedAtMax
            ? bounds.max[cfg.fixedAxis] - this.wallOffset
            : bounds.min[cfg.fixedAxis] + this.wallOffset;
    }

    public setTank(tank: Tank): void {
        this.tank = tank;
    }

    public getEatingCounter(): number {
        return this.eatingCounter;
    }

    private handleAlgaeInteraction(tank: Tank): void {
        if (this.frameCounter % this.ALGAE_INTERACTION_INTERVAL !== 0) return;
        if (this.wall === 'bottom') return;

        const pos = this.position.value;
        const searchRadius = this.size / 2;
        const algaePositionsToCheck = this.getAlgaePositionsInRadius(pos, searchRadius);
        
        for (const checkPos of algaePositionsToCheck) {
            const algaeLevel = tank.algae.getAlgaeLevel(this.wall, checkPos.wallX, checkPos.wallY);
            
            if (algaeLevel > 0) {
                const algaeKey = `${this.wall}-${Math.floor(checkPos.wallX/ALGAE_GRID_SIZE)}-${Math.floor(checkPos.wallY/ALGAE_GRID_SIZE)}`;
                
                if (!this.coveredAlgaePositions.has(algaeKey)) {
                    this.coveredAlgaePositions.add(algaeKey);
                } else {
                    tank.algae.removeAlgae(this.wall, checkPos.wallX, checkPos.wallY);
                    this.coveredAlgaePositions.delete(algaeKey);
                    
                    this.eatingCounter = Math.min(MAX_EATING_COUNTER, this.eatingCounter + algaeLevel * 3);
                    const hungerDecrease = algaeLevel * ALGAE_HUNGER_RATE * (BASE_HUNGER_SIZE / this.size);
                    this.hunger.value = Math.max(0, this.hunger.value - hungerDecrease);
                }
            }
        }
    }

    private handleFoodInteraction(tank: Tank): void {
        const pos = this.position.value;
        const searchRadius = this.size;
        
        for (const food of tank.food) {
            if (food.settled) {
                const distance = this.wallDistance(pos, this.wall, food.position.value, 'bottom');
                if (distance <= searchRadius) {
                    tank.removeFood(food);
                    this.eatingCounter = Math.min(MAX_EATING_COUNTER, this.eatingCounter + FOOD_EATING_BOOST);
                    const hungerDecrease = FOOD_HUNGER_DECREASE * (BASE_HUNGER_SIZE / this.size);
                    this.hunger.value = Math.max(0, this.hunger.value - hungerDecrease);
                    break;
                }
            }
        }
    }

    private getAlgaePositionsInRadius(center: Vector, radius: number): { wallX: number, wallY: number }[] {
        const positions: { wallX: number, wallY: number }[] = [];
        
        const centerPos2D = world3DToWall2D(center, this.wall);
        const centerWallX = centerPos2D.x;
        const centerWallY = centerPos2D.y;
        const wb = sharedGetWall2DBounds(this.wall);
        
        const minWallX = Math.max(wb.minX, centerWallX - radius);
        const maxWallX = Math.min(wb.maxX, centerWallX + radius);
        const minWallY = Math.max(wb.minY, centerWallY - radius);
        const maxWallY = Math.min(wb.maxY, centerWallY + radius);
        
        for (let wallX = Math.floor(minWallX / ALGAE_GRID_SIZE) * ALGAE_GRID_SIZE; wallX <= maxWallX; wallX += ALGAE_GRID_SIZE) {
            for (let wallY = Math.floor(minWallY / ALGAE_GRID_SIZE) * ALGAE_GRID_SIZE; wallY <= maxWallY; wallY += ALGAE_GRID_SIZE) {
                const dx = wallX - centerWallX;
                const dy = wallY - centerWallY;
                if (dx * dx + dy * dy <= radius * radius) {
                    positions.push({ wallX, wallY });
                }
            }
        }
        
        return positions;
    }


    private updateLifeCycle(inhabitants: Inhabitant[]): void {
        switch (this.lifeState) {
            case 'normal': this.updateNormalLifeCycle(); break;
            case 'egg-laying': this.updateEggLayingPhase(); break;
            case 'dying': this.updateDyingPhase(); break;
            case 'shell': this.updateShellPhase(); break;
            case 'dead': this.updateDeadPhase(); break;
        }
    }

    private updateNormalLifeCycle(): void {
        if (this.hunger.value < EGG_HUNGER_THRESHOLD && this.size >= EGG_MIN_SIZE) {
            if (Math.random() < EGG_CHANCE_PER_FRAME) {
                this.enterEggLayingPhase();
            }
        }

        if (this.hunger.value >= 1.0) {
            if (Math.random() < STARVATION_DEATH_CHANCE) {
                this.enterDyingPhase();
            }
        }

        const fullness = 1 - this.hunger.value;
        const sizeModifier = BASE_HUNGER_SIZE / this.size;
        const growthChance = (fullness * fullness * (3 - 2 * fullness)) * sizeModifier / GROWTH_CHANCE_DIVISOR;
        if (this.size < this.maxSize && Math.random() < growthChance) {
            this.grow();
        }
    }

    private grow(): void {
        this.size += 1;
        this.hunger.value = Math.min(1, this.hunger.value + GROWTH_HUNGER_COST);
        this.hunger.increaseRate = BASE_HUNGER_INCREASE_RATE * (this.size / BASE_HUNGER_SIZE);
        this.wallOffset = this.size / 2;
    }

    private enterEggLayingPhase(): void {
        this.lifeState = 'egg-laying';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        this.position.delta = Vector.zero();
        console.log(`🥚 Snail entering egg laying phase at (${this.position.value.x.toFixed(1)}, ${this.position.value.y.toFixed(1)}, ${this.position.value.z.toFixed(1)}) on ${this.wall} wall`);
    }

    private updateEggLayingPhase(): void {
        this.lifeStateCounter++;
        if (this.lifeStateCounter >= EGG_LAYING_FRAMES) {
            this.layEggClump();
            this.lifeState = 'normal';
            this.lifeStateCounter = 0;
            this.canSetGoals = true;
        }
    }

    private layEggClump(): void {
        if (!this.tank) return;
        
        const eggPosition = this.position.value.copy();
        const eggClump = new EggClump(eggPosition, this.wall);
        this.tank.addEggClump(eggClump);
        this.hunger.value = Math.min(1, this.hunger.value + POST_EGG_HUNGER_COST);
        
        console.log(`🥚 Snail laid egg clump at (${eggPosition.x.toFixed(1)}, ${eggPosition.y.toFixed(1)}, ${eggPosition.z.toFixed(1)}) on ${this.wall} wall`);
    }

    private enterDyingPhase(): void {
        this.canSetGoals = false;
        this.position.delta = Vector.zero();
        console.log(`💀 Snail dying at (${this.position.value.x.toFixed(1)}, ${this.position.value.y.toFixed(1)}, ${this.position.value.z.toFixed(1)}) on ${this.wall} wall — switching to shell`);
        // Skip the dying state and go directly to shell phase:
        // the shell sprite should appear immediately, then fall and fade.
        this.enterShellPhase();
    }

    private updateDyingPhase(): void {
        // Dying phase is now skipped (enterDyingPhase transitions straight to shell),
        // but keep this method in case the state is reached unexpectedly.
        this.enterShellPhase();
    }

    private enterShellPhase(): void {
        this.lifeState = 'shell';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        this.shellSettled = false;
        this.opacity = 255;
        this.wall = 'bottom';
        this.wallOffset = this.size / 2;
        this.position.delta = Vector.zero();
        console.log(`🐚 Snail shell falling at (${this.position.value.x.toFixed(1)}, ${this.position.value.y.toFixed(1)}, ${this.position.value.z.toFixed(1)})`);
    }

    private updateShellPhase(): void {
        if (!this.shellSettled) {
            this.opacity = 255;
            this.updateShellFalling();
        } else {
            this.enterDeadPhase();
        }
    }

    private updateShellFalling(): void {
        // Smaller shells sink more slowly (gravity scales linearly with size)
        const sizeScaledGravity = SHELL_GRAVITY * (this.size / this.maxSize);
        this.position.delta.y += sizeScaledGravity;
        
        const bounds = this.bounds;
        // bounds.max.y is already the gravel surface (Y + HEIGHT - GRAVEL_HEIGHT)
        const gravelSurface = bounds.max.y;
        if (this.position.value.y >= gravelSurface - this.wallOffset) {
            this.shellSettled = true;
            this.position.delta = Vector.zero();
            this.position.value.y = gravelSurface - this.wallOffset;
            console.log(`🐚 Shell settled on gravel surface`);
        }
    }

    private enterDeadPhase(): void {
        this.lifeState = 'dead';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        this.opacity = 255;
        console.log(`💀 Shell entering dead phase - will fade over 30 seconds`);
    }

    private updateDeadPhase(): void {
        this.lifeStateCounter++;
        this.opacity = Math.max(0, 255 - (this.lifeStateCounter * 255 / DEAD_FADE_FRAMES));
        if (this.lifeStateCounter >= DEAD_FADE_FRAMES) {
            this.markForRemoval();
        }
    }

    private markForRemoval(): void {
        this.lifeState = 'dead';
        this.lifeStateCounter = DEAD_FADE_FRAMES;
    }

    public getHungerValue(): number {
        return this.hunger.value;
    }

    public getLifeState(): SnailLifeState {
        return this.lifeState;
    }

    public shouldBeRemoved(): boolean {
        return (this.lifeState === 'dead' && this.lifeStateCounter >= DEAD_FADE_FRAMES);
    }

    public setRandomGoal(): void {
        if (!this.canSetGoals) return;
        
        const goalWall = this.getRandomWall();
        const goalPosition = this.getRandomPositionOnWall(goalWall, this.wallOffset);
        
        this.goal = { wall: goalWall, x: goalPosition.x, y: goalPosition.y };
        this.path = this.generatePath(this.goal);
        console.log(`🎯 Baby snail set random goal on ${goalWall} wall`);
    }

    private getSpriteIndexAndRotation(): { index: number; rotation: number; mirrored: boolean } {
        const delta = this.position.delta;
        
        if (this.wall === 'front') {
            const angle = Math.atan2(delta.x, -delta.y);
            return { index: 5, rotation: angle, mirrored: false };
        }
        
        if (this.wall === 'back') {
            // Top sprite faces ~30deg from vertical, subtract offset
            const angle = Math.atan2(delta.x, -delta.y) - Math.PI / 6;
            return { index: 4, rotation: angle, mirrored: false };
        }
        
        // For left, right, and bottom walls: use directional sprites
        const WALL_ANGLE_MAP: Partial<Record<Wall, { xComp: 'x'|'y'|'z', xSign: number, yComp: 'x'|'y'|'z', ySign: number }>> = {
            'left':   { xComp: 'y', xSign: -1, yComp: 'z', ySign: -1 },
            'right':  { xComp: 'y', xSign:  1, yComp: 'z', ySign: -1 },
            'bottom': { xComp: 'x', xSign: -1, yComp: 'z', ySign: -1 },
        };
        const mapping = WALL_ANGLE_MAP[this.wall];
        const angleX = mapping ? mapping.xSign * delta[mapping.xComp] : 0;
        const angleY = mapping ? mapping.ySign * delta[mapping.yComp] : 0;
        
        const angle = Math.atan2(angleY, angleX);
        const degrees = (angle * 180 / Math.PI + 360) % 360;
        
        let spriteIndex: number;
        let mirrored: boolean;
        let baseRotation: number = 0;
        
        // Angle-based sprite mapping
        // Side walls use wider front/back ranges and narrower vertical-motion ranges
        // to better match the perspective viewing angle
        const isSideWall = this.wall === 'left' || this.wall === 'right';
        if (isSideWall) {
            if (degrees >= 345 || degrees < 15) {
                spriteIndex = 0; mirrored = false;
            } else if (degrees >= 15 && degrees < 55) {
                spriteIndex = 1; mirrored = false;
            } else if (degrees >= 55 && degrees < 125) {
                spriteIndex = 2; mirrored = false;
            } else if (degrees >= 125 && degrees < 165) {
                spriteIndex = 1; mirrored = true;
            } else if (degrees >= 165 && degrees < 195) {
                spriteIndex = 0; mirrored = true;
            } else if (degrees >= 195 && degrees < 305) {
                spriteIndex = 3; mirrored = false;
            } else {
                spriteIndex = 0; mirrored = false;
            }
        } else {
            if (degrees >= 337.5 || degrees < 22.5) {
                spriteIndex = 0; mirrored = false;
            } else if (degrees >= 22.5 && degrees < 67.5) {
                spriteIndex = 1; mirrored = false;
            } else if (degrees >= 67.5 && degrees < 112.5) {
                spriteIndex = 2; mirrored = false;
            } else if (degrees >= 112.5 && degrees < 157.5) {
                spriteIndex = 1; mirrored = true;
            } else if (degrees >= 157.5 && degrees < 202.5) {
                spriteIndex = 0; mirrored = true;
            } else if (degrees >= 202.5 && degrees < 292.5) {
                spriteIndex = 3; mirrored = false;
            } else {
                spriteIndex = 0; mirrored = false;
            }
        }
        
        if (this.wall === 'left') {
            baseRotation = Math.PI / 2;
        } else if (this.wall === 'right') {
            baseRotation = -Math.PI / 2;
        }
        
        return { index: spriteIndex, rotation: baseRotation, mirrored: mirrored };
    }

    render(tank: Tank, _color?: p5.Color): void {
        const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(this.position.value);
        const { index, rotation, mirrored } = this.getSpriteIndexAndRotation();
        
        const isShellState = this.lifeState === 'shell' || this.lifeState === 'dead';
        const finalIndex = isShellState ? 6 : index;
        const finalSpriteConfig = Snail.SPRITE_CONFIGS[finalIndex];
        
        // Shell/dead states render upright with no wall-based rotation
        const finalRotation = isShellState ? 0 : rotation;
        const finalMirrored = isShellState ? false : mirrored;
        
        const scale_size = (this.size * depthScale) / SNAIL_SPRITE_HEIGHT;
        const spriteWidth = finalSpriteConfig.width * scale_size;
        const spriteHeight = finalSpriteConfig.height * scale_size;
        
        push();
        translate(renderX, renderY);
        rotate(finalRotation);
        
        if (finalMirrored) {
            scale(-1, 1);
        }
        
        if (Snail.spritesheet) {
            if (this.opacity < 255) {
                tint(255, Math.floor(this.opacity));
            }
            image(
                Snail.spritesheet,
                -spriteWidth/2, -spriteHeight/2,
                spriteWidth, spriteHeight,
                finalSpriteConfig.x, finalSpriteConfig.y,
                finalSpriteConfig.width, finalSpriteConfig.height
            );
            if (this.opacity < 255) {
                noTint();
            }
        }
        
        pop();
    }
}
