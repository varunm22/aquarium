import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Hunger } from '../factors/hunger.js';
import { EggClump } from './egg_clump.js';
import { TANK_CONSTANTS, getTankBounds } from '../constants.js';
export class Snail extends Inhabitant {
    constructor(size = 20, initialPosition, initialWall, initialHunger) {
        let startWall;
        let startPos;
        if (initialPosition && initialWall) {
            // Use provided position and wall (for baby snails)
            startWall = initialWall;
            startPos = initialPosition;
        }
        else {
            // Random initialization (for new snails) - will be set after super()
            startWall = 'back'; // temporary default
            startPos = new Vector(0, 0, 0); // temporary default
        }
        super(new Position(startPos, new Vector(0, 0, 0), false, 0.80), size);
        this.path = [];
        this.goal = null;
        this.baseSpeed = 0.1;
        this.wallOffset = this.size / 2;
        this.coveredAlgaePositions = new Set(); // Track algae positions we've covered
        this.tank = null;
        this.bounds = getTankBounds();
        this.eatingCounter = 0; // Counter for eating algae, affects speed
        this.goalReEvaluationChance = 0.003; // Very small chance to re-evaluate goal each frame
        this.maxSize = 50;
        this.frameCounter = 0; // Frame counter for performance optimizations
        this.ALGAE_INTERACTION_INTERVAL = 5; // Only check algae every 5 frames
        this.lastTransitionFrame = 0; // Track when last wall transition occurred
        this.TRANSITION_COOLDOWN = 10; // Minimum frames between transitions
        this.lifeState = 'normal';
        this.lifeStateCounter = 0; // Counter for current life state
        this.canSetGoals = true; // Whether the snail can set new goals
        this.opacity = 255; // For dying animation
        // Shell properties
        this.shellFalling = false;
        this.shellSettled = false;
        // Now we can use instance methods for random initialization
        if (!initialPosition || !initialWall) {
            startWall = this.getRandomWall();
            startPos = this.getRandomPositionOnWall(startWall, 5);
            this.position.value = startPos;
        }
        this.wall = startWall;
        // Initialize hunger factor with custom value for baby snails or default 20% for new snails
        const hungerValue = initialHunger !== undefined ? initialHunger : 0.2;
        this.hunger = new Hunger(hungerValue, 0, 0.0001); // 3x slower than default
        // Generate unique ID for this snail
        this.id = Math.random().toString(36).substring(2, 8);
        this.setNewGoal();
    }
    static loadSpritesheet() {
        Snail.spritesheet = loadImage('assets/snail_clear.png');
    }
    getRandomWall() {
        const walls = ['front', 'back', 'left', 'right', 'bottom'];
        return walls[Math.floor(random() * walls.length)];
    }
    getRandomPositionOnWall(wall, offset, size = 20) {
        const bounds = this.bounds;
        switch (wall) {
            case 'front':
                return new Vector(bounds.min.x + random() * TANK_CONSTANTS.WIDTH, bounds.min.y + random() * (bounds.max.y - bounds.min.y), bounds.min.z + offset);
            case 'back':
                return new Vector(bounds.min.x + random() * TANK_CONSTANTS.WIDTH, bounds.min.y + random() * (bounds.max.y - bounds.min.y), bounds.max.z - offset);
            case 'left':
                return new Vector(bounds.min.x + offset, bounds.min.y + random() * (bounds.max.y - bounds.min.y), bounds.min.z + random() * (bounds.max.z - bounds.min.z));
            case 'right':
                return new Vector(bounds.max.x - offset, bounds.min.y + random() * (bounds.max.y - bounds.min.y), bounds.min.z + random() * (bounds.max.z - bounds.min.z));
            case 'bottom':
                return new Vector(bounds.min.x + random() * TANK_CONSTANTS.WIDTH, bounds.max.y - offset, bounds.min.z + random() * (bounds.max.z - bounds.min.z));
        }
    }
    // Convert 3D world position to 2D wall coordinates
    world3DToWall(pos, wall) {
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
    // Convert 2D wall coordinates to 3D world position
    wall2DToWorld3D(wallPoint) {
        const bounds = this.bounds;
        switch (wallPoint.wall) {
            case 'front':
                return new Vector(wallPoint.x, wallPoint.y, bounds.min.z + this.wallOffset);
            case 'back':
                return new Vector(wallPoint.x, wallPoint.y, bounds.max.z - this.wallOffset);
            case 'left':
                return new Vector(bounds.min.x + this.wallOffset, wallPoint.y, wallPoint.x);
            case 'right':
                return new Vector(bounds.max.x - this.wallOffset, wallPoint.y, wallPoint.x);
            case 'bottom':
                return new Vector(wallPoint.x, bounds.max.y - this.wallOffset, wallPoint.y);
        }
    }
    wall2DToWorld3DVelocity(wallPoint) {
        switch (wallPoint.wall) {
            case 'front':
                return new Vector(wallPoint.x, wallPoint.y, 0);
            case 'back':
                return new Vector(wallPoint.x, wallPoint.y, 0);
            case 'left':
                return new Vector(0, wallPoint.y, wallPoint.x);
            case 'right':
                return new Vector(0, wallPoint.y, wallPoint.x);
            case 'bottom':
                return new Vector(wallPoint.x, 0, wallPoint.y);
        }
    }
    // Calculate distance between two positions, using 2D distance if on same wall, 3D distance otherwise
    wallDistance(pos1, wall1, pos2, wall2) {
        if (wall1 === wall2) {
            // Same wall: use 2D distance ignoring wall offset
            const pos1_2D = this.world3DToWall(pos1, wall1);
            const pos2_2D = this.world3DToWall(pos2, wall2);
            const dx = pos1_2D.x - pos2_2D.x;
            const dy = pos1_2D.y - pos2_2D.y;
            return Math.sqrt(dx * dx + dy * dy);
        }
        else {
            // Different walls: use 3D distance
            return pos1.distanceTo(pos2);
        }
    }
    setNewGoal() {
        // TOP PRIORITY: Check for settled food at the bottom
        const settledFood = this.findNearestSettledFood();
        if (settledFood) {
            // Found settled food, set goal to food position
            const foodPos = settledFood.position.value;
            const food2D = this.world3DToWall(foodPos, 'bottom');
            this.goal = { wall: 'bottom', x: food2D.x, y: food2D.y };
        }
        else {
            // SECOND PRIORITY: Use best algae hotspot
            const bestAlgaeTarget = this.findBestAlgaeTarget();
            if (bestAlgaeTarget) {
                // Check if we're close to the best target (within 40 units)
                const bestTargetPos = this.wall2DToWorld3D(bestAlgaeTarget);
                const distanceToBestTarget = this.wallDistance(this.position.value, this.wall, bestTargetPos, bestAlgaeTarget.wall);
                if (distanceToBestTarget <= 40) {
                    // We're close to goal, find precise 8x8 square within hotspot region
                    const preciseGoal = this.findPreciseAlgaeGoal(bestAlgaeTarget);
                    this.goal = preciseGoal;
                }
                else {
                    this.goal = bestAlgaeTarget;
                }
            }
            else {
                // FALLBACK: Random goal
                this.setRandomGoal();
                return;
            }
        }
        if (this.goal) {
            this.goal = this.clampGoalToWallBounds(this.goal);
            this.path = this.generatePath(this.goal);
            const pathDesc = this.path.map(p => `${p.wall}(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(' → ');
            console.log(`🐌 New goal: [${this.wall}] → ${pathDesc}`);
        }
    }
    /** Clamp a goal's 2D coordinates to the reachable bounds of its wall */
    clampGoalToWallBounds(goal) {
        const bounds = this.bounds;
        let minX, maxX, minY, maxY;
        switch (goal.wall) {
            case 'front':
            case 'back':
                minX = bounds.min.x;
                maxX = bounds.max.x;
                minY = bounds.min.y;
                maxY = bounds.max.y;
                break;
            case 'left':
            case 'right':
                minX = bounds.min.z;
                maxX = bounds.max.z;
                minY = bounds.min.y;
                maxY = bounds.max.y;
                break;
            case 'bottom':
                minX = bounds.min.x;
                maxX = bounds.max.x;
                minY = bounds.min.z;
                maxY = bounds.max.z;
                break;
        }
        return {
            wall: goal.wall,
            x: Math.max(minX, Math.min(maxX, goal.x)),
            y: Math.max(minY, Math.min(maxY, goal.y))
        };
    }
    findNearestSettledFood() {
        if (!this.tank)
            return null;
        const pos = this.position.value;
        let nearestFood = null;
        let nearestDistance = Infinity;
        // Look through all food in the tank
        for (const food of this.tank.food) {
            // Only consider settled food
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
    findBestAlgaeTarget() {
        if (!this.tank || !this.tank.algae)
            return null;
        // Request hotspot update (will only update if not updated in last 50 frames)
        this.tank.algae.requestHotspotUpdate();
        const pos = this.position.value;
        let bestTarget = null;
        let bestScore = -1;
        const maxDistance = 600; // Maximum distance to consider
        // Check all algae hotspots
        for (const hotspot of this.tank.algae.getAlgaeHotspots()) {
            // Convert hotspot to 3D position for distance calculation
            const hotspotPos = this.wall2DToWorld3D({ wall: hotspot.wall, x: hotspot.centerX, y: hotspot.centerY });
            const distance = this.wallDistance(pos, this.wall, hotspotPos, hotspot.wall);
            if (distance > maxDistance)
                continue;
            // Calculate score: strength adjusted by distance
            const score = hotspot.strength / (distance + 50);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = {
                    wall: hotspot.wall,
                    x: hotspot.centerX,
                    y: hotspot.centerY
                };
            }
        }
        return bestTarget;
    }
    findPreciseAlgaeGoal(hotspotGoal) {
        if (!this.tank || !this.tank.algae) {
            return null;
        }
        // Only work with walls that have algae (exclude bottom wall)
        if (hotspotGoal.wall === 'bottom') {
            return null; // No algae on bottom wall
        }
        // Use the original hotspot region (40x40)
        const regionSize = 40;
        // Calculate region bounds - need to handle coordinate mapping for left/right walls
        let regionCenterX, regionCenterY;
        let regionMinX, regionMaxX, regionMinY, regionMaxY;
        if (hotspotGoal.wall === 'left' || hotspotGoal.wall === 'right') {
            // For left/right walls: hotspotGoal.x is Z-coordinate, hotspotGoal.y is Y-coordinate
            regionCenterX = hotspotGoal.x; // This is actually Z
            regionCenterY = hotspotGoal.y; // This is actually Y
        }
        else {
            // For front/back walls: hotspotGoal.x is X-coordinate, hotspotGoal.y is Y-coordinate
            regionCenterX = hotspotGoal.x;
            regionCenterY = hotspotGoal.y;
        }
        regionMinX = regionCenterX - (regionSize / 2);
        regionMaxX = regionCenterX + (regionSize / 2);
        regionMinY = regionCenterY - (regionSize / 2);
        regionMaxY = regionCenterY + (regionSize / 2);
        // Split into 8x8 pixel squares and find the best one
        const squareSize = 8;
        let bestSquare = null;
        let bestStrength = 0;
        let totalSquaresChecked = 0;
        let squaresWithAlgae = 0;
        // Iterate through 8x8 squares within the expanded region
        for (let squareX = regionMinX; squareX < regionMaxX; squareX += squareSize) {
            for (let squareY = regionMinY; squareY < regionMaxY; squareY += squareSize) {
                totalSquaresChecked++;
                // Calculate algae strength in this 8x8 square
                const squareStrength = this.calculateSquareAlgaeStrength(hotspotGoal.wall, squareX, squareY, squareSize);
                if (squareStrength > 0) {
                    squaresWithAlgae++;
                }
                if (squareStrength > bestStrength) {
                    bestStrength = squareStrength;
                    bestSquare = {
                        x: squareX + (squareSize / 2), // Center of square
                        y: squareY + (squareSize / 2), // Center of square
                        strength: squareStrength
                    };
                }
            }
        }
        // Return the best square as a goal, or fallback to original hotspot
        if (bestSquare && bestSquare.strength > 0) {
            return {
                wall: hotspotGoal.wall,
                x: bestSquare.x,
                y: bestSquare.y
            };
        }
        return null; // No good square found, will fallback to original hotspot
    }
    calculateSquareAlgaeStrength(wall, squareX, squareY, squareSize) {
        if (!this.tank || !this.tank.algae)
            return 0;
        // Sample the center point of the square for simplicity
        const centerX = squareX + (squareSize / 2);
        const centerY = squareY + (squareSize / 2);
        return this.tank.algae.getAlgaeLevel(wall, centerX, centerY);
    }
    generatePath(goal) {
        const startPos2D = this.world3DToWall(this.position.value, this.wall);
        const startWall = this.wall;
        const targetWall = goal.wall;
        const oppositeWall = this.getOppositeWall(startWall);
        if (targetWall !== oppositeWall) {
            // Same or adjacent wall - direct 1-point path
            return [this.clampGoalToWallBounds({ wall: targetWall, x: goal.x, y: goal.y })];
        }
        else {
            // Opposite walls - 2-point path through an intervening wall
            return this.generatePathThroughInterveningWall(startWall, targetWall, startPos2D, goal);
        }
    }
    getOppositeWall(wall) {
        switch (wall) {
            case 'front': return 'back';
            case 'back': return 'front';
            case 'left': return 'right';
            case 'right': return 'left';
            default: return null;
        }
    }
    generatePathThroughInterveningWall(startWall, targetWall, startPos2D, goal) {
        const adjacentWalls = this.getAdjacentWalls(startWall);
        let bestWall = adjacentWalls[0];
        let shortestDistance = Infinity;
        let bestMidpoint = { x: 0, y: 0 };
        // Find best intervening wall and calculate its midpoint in one pass
        for (const interveningWall of adjacentWalls) {
            // Calculate distance using simplified algorithm
            const result = this.calculateSimplePathDistance(startWall, interveningWall, targetWall, startPos2D, goal);
            if (result.distance < shortestDistance) {
                shortestDistance = result.distance;
                bestWall = interveningWall;
                bestMidpoint = result.wallPosition;
            }
        }
        // Return the complete path (clamped to wall bounds)
        return [
            this.clampGoalToWallBounds({ wall: bestWall, x: bestMidpoint.x, y: bestMidpoint.y }),
            this.clampGoalToWallBounds({ wall: targetWall, x: goal.x, y: goal.y })
        ];
    }
    calculateSimplePathDistance(startWall, interveningWall, targetWall, startPos2D, goal) {
        const bounds = this.bounds;
        // Calculate the three distances for this intervening wall
        let distToInterveningWall;
        let distFromGoalToInterveningWall;
        let otherDimensionDiff;
        switch (interveningWall) {
            case 'left':
                distToInterveningWall = startPos2D.x - bounds.min.x;
                distFromGoalToInterveningWall = goal.x - bounds.min.x;
                otherDimensionDiff = Math.abs(goal.y - startPos2D.y);
                break;
            case 'right':
                distToInterveningWall = bounds.max.x - startPos2D.x;
                distFromGoalToInterveningWall = bounds.max.x - goal.x;
                otherDimensionDiff = Math.abs(goal.y - startPos2D.y);
                break;
            case 'front':
                distToInterveningWall = startPos2D.x - bounds.min.z;
                distFromGoalToInterveningWall = goal.x - bounds.min.z;
                otherDimensionDiff = Math.abs(goal.y - startPos2D.y);
                break;
            case 'back':
                distToInterveningWall = bounds.max.z - startPos2D.x;
                distFromGoalToInterveningWall = bounds.max.z - goal.x;
                otherDimensionDiff = Math.abs(goal.y - startPos2D.y);
                break;
            case 'bottom':
                distToInterveningWall = bounds.max.y - startPos2D.y;
                distFromGoalToInterveningWall = bounds.max.y - goal.y;
                otherDimensionDiff = Math.abs(goal.x - startPos2D.x);
                break;
        }
        const longerDist = Math.max(distToInterveningWall, distFromGoalToInterveningWall);
        const shorterDist = Math.min(distToInterveningWall, distFromGoalToInterveningWall);
        const pathDistance = Math.sqrt(Math.pow(longerDist, 2) + Math.pow(otherDimensionDiff, 2)) + shorterDist;
        // Compute midpoint in the INTERVENING wall's 2D coordinate space.
        // Wall 2D mappings: front/back=(worldX,worldY), left/right=(worldZ,worldY), bottom=(worldX,worldZ)
        const startIsCloser = distToInterveningWall < distFromGoalToInterveningWall;
        let midX = 0;
        let midY = 0;
        switch (interveningWall) {
            case 'left':
            case 'right':
                // 2D: x=worldZ, y=worldY. Snail crosses in the worldZ direction.
                midX = (bounds.min.z + bounds.max.z) / 2;
                midY = startIsCloser ? startPos2D.y : goal.y; // shared worldY
                break;
            case 'front':
            case 'back':
                // 2D: x=worldX, y=worldY. Snail crosses in the worldX direction.
                midX = (bounds.min.x + bounds.max.x) / 2;
                midY = startIsCloser ? startPos2D.y : goal.y; // shared worldY
                break;
            case 'bottom':
                // 2D: x=worldX, y=worldZ. Coordinate mapping differs from side walls.
                if (startWall === 'front' || startWall === 'back') {
                    // Front/back share worldX with bottom. Snail crosses in worldZ direction.
                    midX = startIsCloser ? startPos2D.x : goal.x; // shared worldX
                    midY = (bounds.min.z + bounds.max.z) / 2; // center of worldZ
                }
                else {
                    // Left/right share worldZ with bottom. Snail crosses in worldX direction.
                    // left/right 2D x = worldZ, so startPos2D.x / goal.x = worldZ value
                    midX = (bounds.min.x + bounds.max.x) / 2; // center of worldX
                    midY = startIsCloser ? startPos2D.x : goal.x; // shared worldZ
                }
                break;
        }
        return { distance: pathDistance, wallPosition: { x: midX, y: midY } };
    }
    update(inhabitants) {
        // Call parent update to handle position physics
        super.update(inhabitants);
        this.frameCounter++;
        // Update hunger factor
        this.hunger.update();
        // Handle life cycle updates
        this.updateLifeCycle(inhabitants);
        // If snail is in egg laying phase, dying, shell, or dead, don't move
        if (this.lifeState === 'egg-laying' || this.lifeState === 'dying' || this.lifeState === 'shell' || this.lifeState === 'dead') {
            return;
        }
        if (this.path.length === 0) {
            this.setNewGoal();
            return;
        }
        // Get tank reference to access algae and food (cache it)
        if (this.tank) {
            this.handleAlgaeInteraction(this.tank);
            this.handleFoodInteraction(this.tank);
        }
        // Decrease eating counter by 1 each frame (minimum 0)
        this.eatingCounter = Math.max(0, this.eatingCounter - 1);
        // Very small chance to re-evaluate goal each frame
        // Suppress re-evaluation shortly after a wall transition to prevent flickering
        const framesSinceTransition = this.frameCounter - this.lastTransitionFrame;
        if (framesSinceTransition > this.TRANSITION_COOLDOWN * 3 && Math.random() < this.goalReEvaluationChance) {
            this.setNewGoal();
            return;
        }
        const currentTarget = this.path[0];
        // Convert current position to 2D coordinates on current wall
        const currentPos2D = this.world3DToWall(this.position.value, this.wall);
        // Distance to target (only meaningful if on the same wall)
        let distanceToTarget = Infinity;
        if (this.wall === currentTarget.wall) {
            const dx = currentTarget.x - currentPos2D.x;
            const dy = currentTarget.y - currentPos2D.y;
            distanceToTarget = Math.sqrt(dx * dx + dy * dy);
        }
        // Throttled status log: every ~2 seconds (60 frames)
        if (this.frameCounter % 60 === 0) {
            const speed = this.position.delta.magnitude().toFixed(2);
            const targetInfo = this.wall === currentTarget.wall
                ? `dist=${distanceToTarget.toFixed(0)}`
                : `cross-wall`;
            console.log(`🐌 [${this.wall}] target=${currentTarget.wall} ${targetInfo} speed=${speed} path=${this.path.length}`);
        }
        // Check if we've reached the current target (only if on same wall)
        if (distanceToTarget < (this.size / 2) + 5) {
            this.path.shift();
            if (this.path.length === 0) {
                this.setNewGoal();
            }
        }
        // Check for wall transitions based on edge proximity + path
        const didWallTransition = this.checkWallTransition();
        // Only move towards target and clamp position if we didn't transition walls
        if (!didWallTransition) {
            this.moveTowardsCurrentTarget();
            this.clampPositionToWall();
        }
    }
    // include damping here for food eating
    getSpeed() {
        return this.baseSpeed * Math.pow(this.size, 0.5);
    }
    moveTowardsCurrentTarget() {
        if (this.path.length === 0)
            return;
        const currentTarget = this.path[0];
        const currentPos2D = this.world3DToWall(this.position.value, this.wall);
        let dx, dy;
        if (this.wall === currentTarget.wall) {
            // Same wall: head directly to target in 2D
            dx = currentTarget.x - currentPos2D.x;
            dy = currentTarget.y - currentPos2D.y;
        }
        else {
            // Different wall: head toward the connecting edge point.
            // This avoids wasting acceleration pushing into perpendicular walls.
            const edgeTarget = this.getEdgeTarget2D(currentTarget);
            dx = edgeTarget.x - currentPos2D.x;
            dy = edgeTarget.y - currentPos2D.y;
        }
        const vector2D = { wall: this.wall, x: dx, y: dy };
        const acceleration = this.wall2DToWorld3DVelocity(vector2D).normalize().multiply(0.3);
        this.position.applyAcceleration(acceleration, 1);
    }
    /**
     * When heading to a different wall, compute the 2D edge target on the current wall.
     * The target is placed on the connecting edge at the shared coordinate value,
     * so the snail arrives at the right position when it crosses.
     */
    getEdgeTarget2D(target) {
        const bounds = this.bounds;
        switch (`${this.wall}-${target.wall}`) {
            // Side walls to left (edge at x = bounds.min.x, shared: y = worldY)
            case 'front-left':
            case 'back-left':
                return { x: bounds.min.x, y: target.y };
            // Side walls to right (edge at x = bounds.max.x, shared: y = worldY)
            case 'front-right':
            case 'back-right':
                return { x: bounds.max.x, y: target.y };
            // Side walls to bottom (edge at y = bounds.max.y, shared: x = worldX)
            case 'front-bottom':
            case 'back-bottom':
                return { x: target.x, y: bounds.max.y };
            // Left/right to front (edge at z = bounds.min.z → left/right 2D x, shared: y = worldY)
            case 'left-front':
            case 'right-front':
                return { x: bounds.min.z, y: target.y };
            // Left/right to back (edge at z = bounds.max.z → left/right 2D x, shared: y = worldY)
            case 'left-back':
            case 'right-back':
                return { x: bounds.max.z, y: target.y };
            // Left/right to bottom (edge at y = bounds.max.y, shared: worldZ = left/right.x = bottom.y)
            case 'left-bottom':
            case 'right-bottom':
                return { x: target.y, y: bounds.max.y };
            // Bottom to front (edge at z = bounds.min.z → bottom 2D y, shared: x = worldX)
            case 'bottom-front':
                return { x: target.x, y: bounds.min.z };
            // Bottom to back (edge at z = bounds.max.z → bottom 2D y, shared: x = worldX)
            case 'bottom-back':
                return { x: target.x, y: bounds.max.z };
            // Bottom to left (edge at x = bounds.min.x → bottom 2D x, shared: worldZ = bottom.y = left.x)
            case 'bottom-left':
                return { x: bounds.min.x, y: target.x };
            // Bottom to right (edge at x = bounds.max.x → bottom 2D x, shared: worldZ = bottom.y = right.x)
            case 'bottom-right':
                return { x: bounds.max.x, y: target.x };
            default:
                return { x: this.position.value.x, y: this.position.value.y };
        }
    }
    /**
     * Path-aware wall transition: only transitions when the next path target
     * is on an adjacent wall AND we're at the connecting edge.
     * This prevents reactive transitions that conflict with the planned path.
     */
    checkWallTransition() {
        // Cooldown: don't transition too rapidly
        if (this.frameCounter - this.lastTransitionFrame < this.TRANSITION_COOLDOWN) {
            return false;
        }
        // Only transition if the path calls for it
        if (this.path.length === 0)
            return false;
        const targetWall = this.path[0].wall;
        if (targetWall === this.wall)
            return false; // Same wall, no transition needed
        // Must be adjacent
        if (!this.getAdjacentWalls(this.wall).includes(targetWall))
            return false;
        const bounds = this.bounds;
        const pos = this.position.value;
        const edgeThreshold = this.size / 2 + 5;
        // Check if we're at the specific edge connecting current wall to target wall
        let atEdge = false;
        switch (`${this.wall}-${targetWall}`) {
            case 'front-left':
            case 'back-left':
                atEdge = pos.x - bounds.min.x < edgeThreshold;
                break;
            case 'front-right':
            case 'back-right':
                atEdge = bounds.max.x - pos.x < edgeThreshold;
                break;
            case 'front-bottom':
            case 'back-bottom':
            case 'left-bottom':
            case 'right-bottom':
                atEdge = bounds.max.y - pos.y < edgeThreshold;
                break;
            case 'left-front':
            case 'right-front':
                atEdge = pos.z - bounds.min.z < edgeThreshold;
                break;
            case 'left-back':
            case 'right-back':
                atEdge = bounds.max.z - pos.z < edgeThreshold;
                break;
            case 'bottom-front':
                atEdge = pos.z - bounds.min.z < edgeThreshold;
                break;
            case 'bottom-back':
                atEdge = bounds.max.z - pos.z < edgeThreshold;
                break;
            case 'bottom-left':
                atEdge = pos.x - bounds.min.x < edgeThreshold;
                break;
            case 'bottom-right':
                atEdge = bounds.max.x - pos.x < edgeThreshold;
                break;
        }
        if (!atEdge)
            return false;
        // Perform transition
        console.log(`🔄 Wall transition: ${this.wall} → ${targetWall}`);
        this.wall = targetWall;
        this.lastTransitionFrame = this.frameCounter;
        this.position.delta = Vector.zero();
        this.position.ddelta = Vector.zero();
        this.clampPositionToWall();
        return true;
    }
    getAdjacentWalls(wall) {
        const connections = {
            'front': ['left', 'right', 'bottom'],
            'back': ['left', 'right', 'bottom'],
            'left': ['front', 'back', 'bottom'],
            'right': ['front', 'back', 'bottom'],
            'bottom': ['front', 'back', 'left', 'right']
        };
        return connections[wall];
    }
    clampPositionToWall() {
        const bounds = this.bounds;
        const pos = this.position.value;
        pos.x = Math.max(bounds.min.x, Math.min(bounds.max.x, pos.x));
        pos.y = Math.max(bounds.min.y, Math.min(bounds.max.y, pos.y));
        pos.z = Math.max(bounds.min.z, Math.min(bounds.max.z, pos.z));
        switch (this.wall) {
            case 'front':
                pos.z = bounds.min.z + this.wallOffset;
                break;
            case 'back':
                pos.z = bounds.max.z - this.wallOffset;
                break;
            case 'left':
                pos.x = bounds.min.x + this.wallOffset;
                break;
            case 'right':
                pos.x = bounds.max.x - this.wallOffset;
                break;
            case 'bottom':
                pos.y = bounds.max.y - this.wallOffset;
                break;
        }
    }
    // Public method to set tank reference directly (more efficient)
    setTank(tank) {
        this.tank = tank;
    }
    // Public getter for eating counter (fullness)
    getEatingCounter() {
        return this.eatingCounter;
    }
    handleAlgaeInteraction(tank) {
        if (this.frameCounter % this.ALGAE_INTERACTION_INTERVAL !== 0) {
            return;
        }
        // Only interact with algae on walls that support it (not bottom)
        if (this.wall === 'bottom')
            return;
        const pos = this.position.value;
        const searchRadius = this.size / 2;
        // Check for algae within radius around snail's center using 2D wall coordinates
        const algaePositionsToCheck = this.getAlgaePositionsInRadius(pos, searchRadius);
        for (const checkPos of algaePositionsToCheck) {
            const algaeLevel = tank.algae.getAlgaeLevel(this.wall, checkPos.wallX, checkPos.wallY);
            if (algaeLevel > 0) {
                // Create a unique key for this algae position based on 2D wall coordinates
                const algaeKey = `${this.wall}-${Math.floor(checkPos.wallX / 4)}-${Math.floor(checkPos.wallY / 4)}`;
                // If we haven't covered this algae square yet, mark it as covered
                if (!this.coveredAlgaePositions.has(algaeKey)) {
                    this.coveredAlgaePositions.add(algaeKey);
                }
                else {
                    // We've been on this algae square for multiple frames, eat it
                    tank.algae.removeAlgae(this.wall, checkPos.wallX, checkPos.wallY);
                    this.coveredAlgaePositions.delete(algaeKey);
                    // Increase eating counter by algae level (max 200) - this affects movement speed
                    this.eatingCounter = Math.min(200, this.eatingCounter + algaeLevel * 3);
                    // Decrease hunger when eating algae - smaller snails get fuller faster
                    const hungerDecrease = algaeLevel * 0.005 * (20 / this.size);
                    this.hunger.value = Math.max(0, this.hunger.value - hungerDecrease);
                }
            }
        }
    }
    handleFoodInteraction(tank) {
        const pos = this.position.value;
        const searchRadius = this.size;
        // Check for settled food within radius around snail's center
        for (const food of tank.food) {
            if (food.settled) {
                const distance = this.wallDistance(pos, this.wall, food.position.value, 'bottom');
                if (distance <= searchRadius) {
                    // Eat the food and remove it from the tank
                    tank.removeFood(food);
                    // Set eating counter to maximum (100) - this affects movement speed
                    this.eatingCounter = Math.min(200, this.eatingCounter + 50);
                    // Decrease hunger significantly when eating food - smaller snails get fuller faster
                    const hungerDecrease = 0.05 * (20 / this.size);
                    this.hunger.value = Math.max(0, this.hunger.value - hungerDecrease);
                    // Only eat one food at a time
                    break;
                }
            }
        }
    }
    getAlgaePositionsInRadius(center, radius) {
        const positions = [];
        const gridSize = 4; // Algae square size
        // Convert 3D position to 2D wall coordinates
        const centerPos2D = this.world3DToWall(center, this.wall);
        const centerWallX = centerPos2D.x;
        const centerWallY = centerPos2D.y;
        // Get wall bounds in 2D coordinates
        const wall2DBounds = this.getWall2DBounds();
        const minWallX = Math.max(wall2DBounds.minWallX, centerWallX - radius);
        const maxWallX = Math.min(wall2DBounds.maxWallX, centerWallX + radius);
        const minWallY = Math.max(wall2DBounds.minWallY, centerWallY - radius);
        const maxWallY = Math.min(wall2DBounds.maxWallY, centerWallY + radius);
        for (let wallX = Math.floor(minWallX / gridSize) * gridSize; wallX <= maxWallX; wallX += gridSize) {
            for (let wallY = Math.floor(minWallY / gridSize) * gridSize; wallY <= maxWallY; wallY += gridSize) {
                const dx = wallX - centerWallX;
                const dy = wallY - centerWallY;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared <= radius * radius) {
                    positions.push({ wallX, wallY });
                }
            }
        }
        return positions;
    }
    // Get wall bounds in 2D wall coordinate space
    getWall2DBounds() {
        const bounds = this.bounds;
        switch (this.wall) {
            case 'front':
            case 'back':
                return {
                    minWallX: bounds.min.x,
                    maxWallX: bounds.max.x,
                    minWallY: bounds.min.y,
                    maxWallY: bounds.max.y
                };
            case 'left':
            case 'right':
                return {
                    minWallX: bounds.min.z,
                    maxWallX: bounds.max.z,
                    minWallY: bounds.min.y,
                    maxWallY: bounds.max.y
                };
            case 'bottom':
                return {
                    minWallX: bounds.min.x,
                    maxWallX: bounds.max.x,
                    minWallY: bounds.min.z,
                    maxWallY: bounds.max.z
                };
        }
    }
    getCurrentSpeed() {
        const speedMultiplier = 1.2 - Math.min(1, this.eatingCounter / 100);
        return this.baseSpeed * speedMultiplier;
    }
    updateLifeCycle(inhabitants) {
        switch (this.lifeState) {
            case 'normal':
                this.updateNormalLifeCycle();
                break;
            case 'egg-laying':
                this.updateEggLayingPhase();
                break;
            case 'dying':
                this.updateDyingPhase();
                break;
            case 'shell':
                this.updateShellPhase();
                break;
            case 'dead':
                this.updateDeadPhase();
                break;
        }
    }
    updateNormalLifeCycle() {
        // Check for reproduction conditions (less frequent than original)
        if (this.hunger.value < 0.2 && this.size >= 15) {
            // 1/2000 chance per frame to enter egg laying phase (much less frequent than original)
            // if (Math.random() < 0.0005) {
            if (Math.random() < 0.0005) {
                this.enterEggLayingPhase();
            }
        }
        // Check for death conditions
        if (this.hunger.value >= 1.0) {
            // 1/1000 chance per frame to die when starving
            if (Math.random() < 0.1) {
                this.enterDyingPhase();
            }
        }
        // Check for growth
        const growthChance = (1 - this.hunger.value) / 500;
        if (this.size < this.maxSize && Math.random() < growthChance) {
            this.grow();
        }
    }
    grow() {
        this.size += 1;
        this.hunger.value = Math.min(1, this.hunger.value + 0.05); // Increase hunger by 10%
        this.baseSpeed = 0.2 * Math.pow(this.size, 0.5); // Update base speed with new formula
        this.wallOffset = this.size / 2; // Update wall offset for new size
    }
    enterEggLayingPhase() {
        this.lifeState = 'egg-laying';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        // Stop moving
        this.position.delta = Vector.zero();
        // Acceleration is now handled by Position system
        console.log(`🥚 Snail entering egg laying phase at (${this.position.value.x.toFixed(1)}, ${this.position.value.y.toFixed(1)}, ${this.position.value.z.toFixed(1)}) on ${this.wall} wall`);
    }
    updateEggLayingPhase() {
        this.lifeStateCounter++;
        // Egg laying phase lasts 120 frames (2 seconds at 60fps)
        if (this.lifeStateCounter >= 120) {
            // Egg laying phase complete, lay the egg clump
            this.layEggClump();
            // Return to normal state
            this.lifeState = 'normal';
            this.lifeStateCounter = 0;
            this.canSetGoals = true;
        }
    }
    layEggClump() {
        if (!this.tank)
            return;
        // Create egg clump at current position
        const eggPosition = this.position.value.copy();
        const eggClump = new EggClump(eggPosition, this.wall);
        // Add to tank
        this.tank.addEggClump(eggClump);
        // Increase hunger after laying eggs (reproduction is costly)
        this.hunger.value = Math.min(1, this.hunger.value + 0.75);
        console.log(`🥚 Snail laid egg clump at (${eggPosition.x.toFixed(1)}, ${eggPosition.y.toFixed(1)}, ${eggPosition.z.toFixed(1)}) on ${this.wall} wall`);
    }
    enterDyingPhase() {
        this.lifeState = 'dying';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        // Stop moving
        this.position.delta = Vector.zero();
        // Acceleration is now handled by Position system
        console.log(`💀 Snail entering dying phase at (${this.position.value.x.toFixed(1)}, ${this.position.value.y.toFixed(1)}, ${this.position.value.z.toFixed(1)}) on ${this.wall} wall`);
    }
    updateDyingPhase() {
        this.lifeStateCounter++;
        // Gradually decrease opacity over 1000 frames (about 16 seconds at 60fps)
        this.opacity = Math.max(0, 255 - (this.lifeStateCounter * 255 / 1000));
        if (this.lifeStateCounter >= 1000) {
            // Death complete, transition to shell phase
            this.enterShellPhase();
        }
    }
    enterShellPhase() {
        this.lifeState = 'shell';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        this.shellFalling = true;
        this.shellSettled = false;
        this.opacity = 255; // Reset opacity for shell phase
        // Switch to bottom wall for falling
        this.wall = 'bottom';
        this.wallOffset = this.size / 2;
        // Set initial velocity for falling
        this.position.delta = Vector.zero();
        // Acceleration is now handled by Position system
        console.log(`🐚 Snail shell falling at (${this.position.value.x.toFixed(1)}, ${this.position.value.y.toFixed(1)}, ${this.position.value.z.toFixed(1)})`);
    }
    updateShellPhase() {
        if (!this.shellSettled) {
            // Shell is still falling - keep full opacity
            this.opacity = 255;
            this.updateShellFalling();
        }
        else {
            // Shell has settled, transition to dead phase
            this.enterDeadPhase();
        }
    }
    updateShellFalling() {
        // Apply slower gravity to make shell fall more slowly
        const gravity = 0.2; // Reduced from 0.5 to 0.2 for slower falling
        this.position.delta.y += gravity;
        // Position will be updated automatically by Position.update() in the normal update cycle
        // Check if shell has reached the gravel surface (not below gravel)
        const bounds = this.bounds;
        const gravelSurface = bounds.max.y - TANK_CONSTANTS.GRAVEL_HEIGHT; // Land on gravel surface
        if (this.position.value.y >= gravelSurface - this.wallOffset) {
            // Shell has settled on the gravel surface
            this.shellSettled = true;
            this.position.delta = Vector.zero(); // Stop falling
            this.position.value.y = gravelSurface - this.wallOffset; // Clamp to gravel surface
            console.log(`🐚 Shell settled on gravel surface`);
        }
    }
    enterDeadPhase() {
        this.lifeState = 'dead';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        this.opacity = 255; // Start fade from full opacity
        console.log(`💀 Shell entering dead phase - will fade over 30 seconds`);
    }
    updateDeadPhase() {
        this.lifeStateCounter++;
        // Fade out over 1800 frames (30 seconds at 60fps)
        this.opacity = Math.max(0, 255 - (this.lifeStateCounter * 255 / 1800));
        if (this.lifeStateCounter >= 1800) {
            // Fade complete, mark for removal
            this.markForRemoval();
        }
    }
    markForRemoval() {
        // This will be handled by the tank's update method
        // We'll add a flag to indicate the snail should be removed
        this.lifeState = 'dead';
        this.lifeStateCounter = 1800; // Ensure it stays in dead state
    }
    // Public method to get hunger value
    getHungerValue() {
        return this.hunger.value;
    }
    // Public method to get life state
    getLifeState() {
        return this.lifeState;
    }
    // Public method to get current wall (for debugging display)
    getWall() {
        return this.wall;
    }
    // Public method to check if snail should be removed
    shouldBeRemoved() {
        return (this.lifeState === 'dead' && this.lifeStateCounter >= 1800);
    }
    // Public method to set a random goal (useful for baby snails)
    setRandomGoal() {
        if (!this.canSetGoals)
            return;
        const goalWall = this.getRandomWall();
        const goalPosition = this.getRandomPositionOnWall(goalWall, this.wallOffset);
        // Convert Vector to Goal format
        this.goal = {
            wall: goalWall,
            x: goalPosition.x,
            y: goalPosition.y
        };
        this.path = this.generatePath(this.goal);
        console.log(`🎯 Baby snail set random goal on ${goalWall} wall`);
    }
    getSpriteIndexAndRotation() {
        const delta = this.position.delta;
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
        let angle;
        let angleX, angleY;
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
        let spriteIndex;
        let mirrored;
        let baseRotation = 0;
        if (degrees >= 337.5 || degrees < 22.5) {
            spriteIndex = 0;
            mirrored = false; // left
        }
        else if (degrees >= 22.5 && degrees < 67.5) {
            spriteIndex = 1;
            mirrored = false; // diagonal front
        }
        else if (degrees >= 67.5 && degrees < 112.5) {
            spriteIndex = 2;
            mirrored = false; // front
        }
        else if (degrees >= 112.5 && degrees < 157.5) {
            spriteIndex = 1;
            mirrored = true; // diagonal front (mirrored for right)
        }
        else if (degrees >= 157.5 && degrees < 202.5) {
            spriteIndex = 0;
            mirrored = true; // left (mirrored for right)
        }
        else if (degrees >= 202.5 && degrees < 292.5) {
            spriteIndex = 3;
            mirrored = false; // back
        }
        else {
            // 292.5-337.5: back-left, use left sprite
            spriteIndex = 0;
            mirrored = false; // left
        }
        // Apply wall-specific rotation offsets
        if (this.wall === 'left') {
            // Rotate 90 degrees clockwise (+ π/2 radians)
            baseRotation = Math.PI / 2;
        }
        else if (this.wall === 'right') {
            // Rotate 90 degrees counterclockwise (- π/2 radians)
            baseRotation = -Math.PI / 2;
        }
        return { index: spriteIndex, rotation: baseRotation, mirrored: mirrored };
    }
    render(tank, _color) {
        // Use sprite rendering
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.667, relativeDepth);
        // Scale size based on depth
        const depthScale = lerp(1, 0.7, relativeDepth);
        const { index, rotation, mirrored } = this.getSpriteIndexAndRotation();
        const spriteConfig = Snail.SPRITE_CONFIGS[index];
        // If snail is in shell or dead phase, always use empty shell sprite
        const finalIndex = (this.lifeState === 'shell' || this.lifeState === 'dead') ? 6 : index;
        const finalSpriteConfig = Snail.SPRITE_CONFIGS[finalIndex];
        // Use height as the consistent scaling factor
        const MAX_SPRITE_HEIGHT = 32; // Height of sprites
        // Calculate scale based on the snail's size and the sprite height
        const scale_size = (this.size * depthScale) / MAX_SPRITE_HEIGHT;
        const spriteWidth = finalSpriteConfig.width * scale_size;
        const spriteHeight = finalSpriteConfig.height * scale_size;
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
        // Apply opacity by using tint
        if (this.opacity < 255) {
            // Note: p5.js doesn't support alpha in image() directly, so we'll use the fallback circle for dying/dead snails
            // This ensures opacity is properly handled
            pop(); // Restore transformation state
            push();
            fill(139, 69, 19, Math.floor(this.opacity));
            noStroke();
            ellipse(0, 0, spriteWidth, spriteHeight);
        }
        else if (Snail.spritesheet) {
            image(Snail.spritesheet, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight, finalSpriteConfig.x, finalSpriteConfig.y, finalSpriteConfig.width, finalSpriteConfig.height);
        }
        // Restore the original transformation state
        pop();
    }
}
Snail.spritesheet = null;
Snail.SPRITE_CONFIGS = [
    { x: 10, y: 40, width: 48, height: 34 }, // 0: left
    { x: 80, y: 40, width: 40, height: 34 }, // 1: diagonal front
    { x: 137, y: 40, width: 33, height: 34 }, // 2: front
    { x: 181, y: 40, width: 28, height: 32 }, // 3: back
    { x: 108, y: 90, width: 43, height: 42 }, // 4: top (for back wall)
    { x: 171, y: 89, width: 24, height: 38 }, // 5: bottom (for front wall)
    { x: 25, y: 89, width: 34, height: 28 } // 6: empty shell
];
