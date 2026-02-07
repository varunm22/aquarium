import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Hunger } from '../factors/hunger.js';
import { TANK_CONSTANTS } from '../constants.js';
export class Snail extends Inhabitant {
    constructor(size = 20) {
        const startWall = Snail.getRandomWall();
        const startPos = Snail.getRandomPositionOnWall(startWall, 5);
        super(new Position(startPos, new Vector(0, 0, 0), false), size);
        this.path = [];
        this.goal = null;
        this.baseSpeed = 0.1 * Math.pow(this.size, 0.5);
        this.wallOffset = this.size / 2;
        this.velocity = Vector.zero(); // Current velocity vector
        this.acceleration = Vector.zero(); // Current acceleration vector
        this.coveredAlgaePositions = new Set(); // Track algae positions we've covered
        this.tank = null;
        this.eatingCounter = 0; // Counter for eating algae, affects speed
        this.goalReEvaluationChance = 0.005; // Very small chance to re-evaluate goal each frame
        this.frameCounter = 0; // Frame counter for performance optimizations
        this.ALGAE_INTERACTION_INTERVAL = 5; // Only check algae every 5 frames
        this.lifeState = 'normal';
        this.lifeStateCounter = 0; // Counter for current life state
        this.opacity = 255; // For dying animation
        this.canSetGoals = true; // Whether the snail can set new goals
        // Shell properties
        this.shellFalling = false;
        this.shellSettled = false;
        this.wall = startWall;
        // Initialize hunger factor (starts at 20%) with slower increase rate for snails
        this.hunger = new Hunger(0.2, 0, 0.0001); // 3x slower than default
        // Generate unique ID for this snail
        this.id = Math.random().toString(36).substring(2, 8);
        // If this is a newly hatched snail (size 2), start in egg phase
        if (size === 2) {
            this.lifeState = 'egg';
            this.lifeStateCounter = 400; // 400 frames until hatching
            this.canSetGoals = false;
        }
        this.setNewGoal();
    }
    static loadSpritesheet() {
        Snail.spritesheet = loadImage('assets/snail_clear.png');
    }
    static getRandomWall() {
        const walls = ['front', 'back', 'left', 'right', 'bottom'];
        return walls[Math.floor(random() * walls.length)];
    }
    static getTankBounds() {
        return {
            minX: TANK_CONSTANTS.X,
            maxX: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH,
            minY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT,
            maxY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT,
            minZ: TANK_CONSTANTS.MIN_Z,
            maxZ: TANK_CONSTANTS.DEPTH
        };
    }
    static getRandomPositionOnWall(wall, offset) {
        const bounds = Snail.getTankBounds();
        switch (wall) {
            case 'front':
                return new Vector(bounds.minX + random() * TANK_CONSTANTS.WIDTH, bounds.minY + random() * (bounds.maxY - bounds.minY), bounds.minZ + offset);
            case 'back':
                return new Vector(bounds.minX + random() * TANK_CONSTANTS.WIDTH, bounds.minY + random() * (bounds.maxY - bounds.minY), bounds.maxZ - offset);
            case 'left':
                return new Vector(bounds.minX + offset, bounds.minY + random() * (bounds.maxY - bounds.minY), bounds.minZ + random() * (bounds.maxZ - bounds.minZ));
            case 'right':
                return new Vector(bounds.maxX - offset, bounds.minY + random() * (bounds.maxY - bounds.minY), bounds.minZ + random() * (bounds.maxZ - bounds.minZ));
            case 'bottom':
                return new Vector(bounds.minX + random() * TANK_CONSTANTS.WIDTH, bounds.maxY - offset, bounds.minZ + random() * (bounds.maxZ - bounds.minZ));
        }
    }
    setNewGoal() {
        if (!this.tank) {
            // Fallback to random goal if no tank access
            const goalWall = Snail.getRandomWall();
            this.goal = Snail.getRandomPositionOnWall(goalWall, this.wallOffset);
        }
        else {
            // TOP PRIORITY: Check for settled food at the bottom
            const settledFood = this.findNearestSettledFood();
            if (settledFood) {
                // Found settled food, set goal to food position
                this.goal = new Vector(settledFood.position.x, settledFood.position.y, settledFood.position.z);
            }
            else {
                // Use hierarchical algae finding
                this.goal = this.findHierarchicalAlgaeGoal();
            }
        }
        // Check if the new goal is too close to the old goal (within 1 unit)
        if (this.goal && this.path.length > 0) {
            const lastPathPoint = this.path[this.path.length - 1];
            const distanceToOldGoal = this.goal.distanceTo(lastPathPoint.position);
            if (distanceToOldGoal <= 1) {
                this.goal = Snail.getRandomPositionOnWall(this.wall, this.wallOffset);
                // New goal is too close to old goal, don't regenerate path
                return;
            }
        }
        console.log('goal', this.goal, this.size);
        this.path = this.generatePath(this.position.value, this.goal);
    }
    hotspotToVector(hotspot) {
        const bounds = Snail.getTankBounds();
        switch (hotspot.wall) {
            case 'front':
                return new Vector(hotspot.centerX, hotspot.centerY, bounds.minZ + this.wallOffset);
            case 'back':
                return new Vector(hotspot.centerX, hotspot.centerY, bounds.maxZ - this.wallOffset);
            case 'left':
                return new Vector(bounds.minX + this.wallOffset, hotspot.centerY, hotspot.centerX);
            case 'right':
                return new Vector(bounds.maxX - this.wallOffset, hotspot.centerY, hotspot.centerX);
            default:
                return new Vector(0, 0, 0);
        }
    }
    findHierarchicalAlgaeGoal() {
        const pos = this.position.value;
        // Use the algae hotspot system
        if (this.tank && this.tank.algae) {
            // Request hotspot update (will only update if not updated in last 50 frames)
            this.tank.algae.requestHotspotUpdate();
            const hotspots = this.tank.algae.getAlgaeHotspots();
            if (hotspots.length > 0) {
                // Find the best hotspot based on distance and strength
                let bestHotspot = hotspots[0];
                let bestScore = -1;
                const maxDistance = 1200;
                for (const hotspot of hotspots) {
                    // Convert hotspot to 3D position for distance calculation
                    const hotspotPos = this.hotspotToVector(hotspot);
                    const distance = pos.distanceTo(hotspotPos);
                    if (distance > maxDistance)
                        continue;
                    // Calculate score: strength adjusted by distance
                    const effectiveDistance = Math.max(distance, 50);
                    const score = hotspot.strength / (effectiveDistance + 50);
                    if (score > bestScore) {
                        bestScore = score;
                        bestHotspot = hotspot;
                    }
                }
                // Convert best hotspot to 3D position
                const bestTarget = this.hotspotToVector(bestHotspot);
                console.log(`🎯 Found algae hotspot: pos(${bestTarget.x.toFixed(1)}, ${bestTarget.y.toFixed(1)}, ${bestTarget.z.toFixed(1)}) on ${bestHotspot.wall} wall`);
                console.log("PATH", this.path);
                return bestTarget;
            }
        }
        // No algae found, set random goal
        console.log(`❌ No algae targets found - using random goal`);
        const goalWall = Snail.getRandomWall();
        return Snail.getRandomPositionOnWall(goalWall, this.wallOffset);
    }
    findBestAlgaeSquare(center, squareSize) {
        if (!this.tank || this.wall === 'bottom')
            return null;
        const searchRadius = squareSize * 2; // Look in a larger area to find the best square
        const gridSize = 4; // Algae square size
        const squareMap = new Map();
        // Get wall bounds
        const wallBounds = this.getWallBounds();
        const minX = Math.max(wallBounds.minX, center.x - searchRadius);
        const maxX = Math.min(wallBounds.maxX, center.x + searchRadius);
        const minY = Math.max(wallBounds.minY, center.y - searchRadius);
        const maxY = Math.min(wallBounds.maxY, center.y + searchRadius);
        // Step by grid size to check each potential square center
        for (let x = Math.floor(minX / squareSize) * squareSize + squareSize / 2; x <= maxX; x += squareSize) {
            for (let y = Math.floor(minY / squareSize) * squareSize + squareSize / 2; y <= maxY; y += squareSize) {
                // Calculate z based on current wall
                let z = center.z;
                switch (this.wall) {
                    case 'front':
                        z = wallBounds.minZ + this.wallOffset;
                        break;
                    case 'back':
                        z = wallBounds.maxZ - this.wallOffset;
                        break;
                    case 'left':
                    case 'right':
                        z = center.z;
                        break;
                }
                const squareCenter = new Vector(x, y, z);
                const squareStrength = this.calculateSquareAlgaeStrength(squareCenter, squareSize);
                if (squareStrength > 0) {
                    const key = `${Math.floor(x / squareSize)}-${Math.floor(y / squareSize)}`;
                    squareMap.set(key, { center: squareCenter, strength: squareStrength });
                }
            }
        }
        // Find the strongest and second strongest squares
        let bestSquare = null;
        let secondBestSquare = null;
        let bestStrength = 0;
        let secondBestStrength = 0;
        for (const square of squareMap.values()) {
            if (square.strength > bestStrength) {
                // Current best becomes second best
                secondBestSquare = bestSquare;
                secondBestStrength = bestStrength;
                // New best
                bestStrength = square.strength;
                bestSquare = square;
            }
            else if (square.strength > secondBestStrength) {
                // New second best
                secondBestSquare = square;
                secondBestStrength = square.strength;
            }
        }
        if (bestSquare) {
            return {
                center: bestSquare.center,
                strength: bestSquare.strength,
                secondBest: secondBestSquare
            };
        }
        return null;
    }
    calculateSquareAlgaeStrength(center, squareSize) {
        if (!this.tank)
            return 0;
        const halfSize = squareSize / 2;
        let totalStrength = 0;
        const gridSize = 4;
        // Check each grid position within the square
        for (let x = center.x - halfSize; x <= center.x + halfSize; x += gridSize) {
            for (let y = center.y - halfSize; y <= center.y + halfSize; y += gridSize) {
                const checkPos = new Vector(x, y, center.z);
                // Only check algae on walls that support it (not bottom)
                if (this.wall !== 'bottom') {
                    const algaeLevel = this.tank.algae.getAlgaeLevel(this.wall, checkPos.x, checkPos.y, checkPos.z);
                    totalStrength += algaeLevel;
                }
            }
        }
        return totalStrength;
    }
    isInSquare(pos, squareCenter, squareSize) {
        const halfSize = squareSize / 2;
        return Math.abs(pos.x - squareCenter.x) <= halfSize &&
            Math.abs(pos.y - squareCenter.y) <= halfSize;
    }
    findBestSingleAlgae(center, searchRadius) {
        if (!this.tank)
            return null;
        const gridSize = 4;
        let bestAlgae = null;
        let bestStrength = 0;
        // Check each grid position within the search radius
        for (let x = center.x - searchRadius; x <= center.x + searchRadius; x += gridSize) {
            for (let y = center.y - searchRadius; y <= center.y + searchRadius; y += gridSize) {
                const checkPos = new Vector(x, y, center.z);
                const distance = center.distanceTo(checkPos);
                if (distance <= searchRadius) {
                    // Only check algae on walls that support it (not bottom)
                    if (this.wall !== 'bottom') {
                        const algaeLevel = this.tank.algae.getAlgaeLevel(this.wall, checkPos.x, checkPos.y, checkPos.z);
                        if (algaeLevel > bestStrength) {
                            bestStrength = algaeLevel;
                            bestAlgae = checkPos.copy();
                        }
                    }
                }
            }
        }
        return bestAlgae;
    }
    clampPositionToWallPosition(pos) {
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
                const distance = pos.distanceTo(food.position.value);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestFood = food;
                }
            }
        }
        return nearestFood;
    }
    getWallBounds() {
        const bounds = Snail.getTankBounds();
        return bounds;
    }
    generatePath(startPos, endPos) {
        const startWall = this.getWallFromPosition(startPos);
        const endWall = this.getWallFromPosition(endPos);
        if (startWall === endWall) {
            return [{ position: endPos, wall: endWall }];
        }
        const adjacentWalls = this.getAdjacentWalls(startWall);
        if (adjacentWalls.includes(endWall)) {
            const edgePoint = this.getEdgeIntersection(startPos, endPos, startWall, endWall);
            // should this be startWall or endWall for the first position??
            return [
                { position: edgePoint, wall: startWall },
                { position: endPos, wall: endWall }
            ];
        }
        const oppositeWall = this.getOppositeWall(startWall);
        if (endWall === oppositeWall) {
            const possiblePaths = [];
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
                }
                else if (startWall !== 'bottom' && endWall !== 'bottom') {
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
            let shortestPath = [];
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
    getPathLength(startPos, path) {
        let totalDistance = 0;
        let lastPos = startPos;
        for (const point of path) {
            totalDistance += lastPos.distanceTo(point);
            lastPos = point;
        }
        return totalDistance;
    }
    getEdgeIntersection(startPos, endPos, startWall, endWall) {
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
    getOppositeWall(wall) {
        switch (wall) {
            case 'front': return 'back';
            case 'back': return 'front';
            case 'left': return 'right';
            case 'right': return 'left';
            default: return null;
        }
    }
    update(inhabitants) {
        this.frameCounter++;
        // Update hunger factor
        this.hunger.update();
        // Handle life cycle updates
        this.updateLifeCycle(inhabitants);
        // If snail is dying or in egg phase, don't move
        if (this.lifeState === 'dying' || this.lifeState === 'egg') {
            return;
        }
        if (this.path.length === 0) {
            if (this.canSetGoals) {
                this.setNewGoal();
            }
            return;
        }
        // Get tank reference to access algae and food (cache it)
        if (!this.tank) {
            this.tank = this.getTank(inhabitants);
        }
        if (this.tank) {
            this.handleAlgaeInteraction(this.tank);
            this.handleFoodInteraction(this.tank);
        }
        // Decrease eating counter by 1 each frame (minimum 0)
        this.eatingCounter = Math.max(0, this.eatingCounter - 1);
        // Very small chance to re-evaluate goal each frame (only if can set goals)
        if (this.canSetGoals && Math.random() < this.goalReEvaluationChance) {
            this.setNewGoal();
            return;
        }
        const currentTarget = this.path[0];
        const distanceToTarget = this.position.value.distanceTo(currentTarget.position);
        this.moveTowardsCurrentTarget();
        // Check if we've reached the current target
        if (distanceToTarget < 8) {
            // Remove the reached point from the path
            this.path.shift();
            if (this.path.length > 0) {
                // Switch to the new wall and set movement vector towards next target
                const nextTarget = this.path[0];
                if (currentTarget.wall !== this.wall) {
                    this.transitionToWall(currentTarget.wall);
                }
                this.updateAccelerationTowardsTarget(nextTarget.position);
            }
            else {
                // Path completed, set new goal
                if (this.canSetGoals) {
                    this.setNewGoal();
                }
            }
        }
        this.clampPositionToWall();
    }
    moveTowardsCurrentTarget() {
        if (this.path.length === 0) {
            this.velocity = Vector.zero();
            this.acceleration = Vector.zero();
            return;
        }
        const currentTarget = this.path[0];
        this.updateAccelerationTowardsTarget(currentTarget.position);
        // Apply acceleration to velocity
        this.velocity.addInPlace(this.acceleration);
        // Clamp velocity to maximum speed
        const maxSpeed = this.getCurrentSpeed();
        const currentSpeed = this.velocity.magnitude();
        if (currentSpeed > maxSpeed) {
            this.velocity.normalize().multiplyInPlace(maxSpeed);
        }
        // Apply velocity to position
        this.position.value.addInPlace(this.velocity);
    }
    updateAccelerationTowardsTarget(target) {
        const toTarget = target.copy().subtractInPlace(this.position.value);
        let projectedToTarget;
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
            // Set acceleration to 20% of max speed in the direction of the target
            const maxSpeed = this.getCurrentSpeed();
            const accelerationMagnitude = maxSpeed * 0.2;
            this.acceleration = projectedToTarget.normalize().multiplyInPlace(accelerationMagnitude);
        }
        else {
            this.acceleration = Vector.zero();
        }
    }
    transitionToWall(newWall) {
        const oldWall = this.wall;
        this.wall = newWall;
        // Transform the current velocity vector for the new wall orientation
        const v = this.velocity.copy();
        switch (`${oldWall}-${newWall}`) {
            // Front to sides
            case 'front-left':
                this.velocity = new Vector(0, v.y, -v.x);
                break;
            case 'front-right':
                this.velocity = new Vector(0, v.y, v.x);
                break;
            case 'front-bottom':
                this.velocity = new Vector(v.x, 0, -v.y);
                break;
            // Back to sides
            case 'back-left':
                this.velocity = new Vector(0, v.y, v.x);
                break;
            case 'back-right':
                this.velocity = new Vector(0, v.y, -v.x);
                break;
            case 'back-bottom':
                this.velocity = new Vector(v.x, 0, v.y);
                break;
            // Left to sides
            case 'left-front':
                this.velocity = new Vector(-v.z, v.y, 0);
                break;
            case 'left-back':
                this.velocity = new Vector(v.z, v.y, 0);
                break;
            case 'left-bottom':
                this.velocity = new Vector(v.z, 0, -v.y);
                break;
            // Right to sides
            case 'right-front':
                this.velocity = new Vector(v.z, v.y, 0);
                break;
            case 'right-back':
                this.velocity = new Vector(-v.z, v.y, 0);
                break;
            case 'right-bottom':
                this.velocity = new Vector(-v.z, 0, -v.y);
                break;
            // Bottom to sides
            case 'bottom-front':
                this.velocity = new Vector(v.x, -v.z, 0);
                break;
            case 'bottom-back':
                this.velocity = new Vector(v.x, v.z, 0);
                break;
            case 'bottom-left':
                this.velocity = new Vector(0, v.z, v.x);
                break;
            case 'bottom-right':
                this.velocity = new Vector(0, v.z, -v.x);
                break;
            default:
                // If no specific transformation, reset velocity vector
                this.velocity = Vector.zero();
                break;
        }
        this.clampPositionToWall();
    }
    getWallFromPosition(pos) {
        const bounds = Snail.getTankBounds();
        const dists = {
            front: Math.abs(pos.z - bounds.minZ),
            back: Math.abs(pos.z - bounds.maxZ),
            left: Math.abs(pos.x - bounds.minX),
            right: Math.abs(pos.x - bounds.maxX),
            bottom: Math.abs(pos.y - bounds.maxY)
        };
        let closestWall = 'front';
        let minDist = dists.front;
        for (const [wall, dist] of Object.entries(dists)) {
            if (dist < minDist) {
                minDist = dist;
                closestWall = wall;
            }
        }
        return closestWall;
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
    getTank(inhabitants) {
        // Find tank by looking for it in the inhabitants array or by accessing it through context
        // This is a bit of a hack, but we need access to the tank
        for (const inhabitant of inhabitants) {
            if (inhabitant.tank) {
                return inhabitant.tank;
            }
        }
        return null;
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
        // Check for algae within radius around snail's center
        const algaePositionsToCheck = this.getAlgaePositionsInRadius(pos, searchRadius);
        for (const checkPos of algaePositionsToCheck) {
            const algaeLevel = tank.algae.getAlgaeLevel(this.wall, checkPos.x, checkPos.y, checkPos.z);
            if (algaeLevel > 0) {
                // Create a unique key for this algae position based on grid coordinates
                const algaeKey = `${this.wall}-${Math.floor(checkPos.x / 4)}-${Math.floor(checkPos.y / 4)}-${Math.floor(checkPos.z / 4)}`;
                // If we haven't covered this algae square yet, mark it as covered
                if (!this.coveredAlgaePositions.has(algaeKey)) {
                    this.coveredAlgaePositions.add(algaeKey);
                }
                else {
                    // We've been on this algae square for multiple frames, eat it
                    tank.algae.removeAlgae(this.wall, checkPos.x, checkPos.y, checkPos.z);
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
                const distance = pos.distanceTo(food.position.value);
                if (distance <= searchRadius) {
                    console.log('eating food', distance);
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
        // Optimized: Only check 2D positions on the current wall
        // This reduces complexity from O(n³) to O(n²)
        const wallBounds = this.getWallBounds();
        const minX = Math.max(wallBounds.minX, center.x - radius);
        const maxX = Math.min(wallBounds.maxX, center.x + radius);
        const minY = Math.max(wallBounds.minY, center.y - radius);
        const maxY = Math.min(wallBounds.maxY, center.y + radius);
        // Calculate z based on current wall
        let z = center.z; // Default to current z
        switch (this.wall) {
            case 'front':
                z = wallBounds.minZ + this.wallOffset;
                break;
            case 'back':
                z = wallBounds.maxZ - this.wallOffset;
                break;
            case 'left':
                z = center.z; // Keep current z for side walls
                break;
            case 'right':
                z = center.z; // Keep current z for side walls
                break;
        }
        // Generate grid positions within the radius (2D only)
        for (let x = Math.floor(minX / gridSize) * gridSize; x <= maxX; x += gridSize) {
            for (let y = Math.floor(minY / gridSize) * gridSize; y <= maxY; y += gridSize) {
                // Use squared distance to avoid square root calculation
                const dx = x - center.x;
                const dy = y - center.y;
                const distanceSquared = dx * dx + dy * dy;
                // Check if this grid position is within radius (squared)
                if (distanceSquared <= radius * radius) {
                    positions.push(new Vector(x, y, z));
                }
            }
        }
        return positions;
    }
    getCurrentSpeed() {
        // Speed = baseSpeed * (1 - eatingCounter/100)
        const speedMultiplier = 1 - Math.min(1, this.eatingCounter / 100);
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
            case 'egg':
                this.updateEggPhase();
                break;
            case 'dying':
                this.updateDyingPhase();
                break;
            case 'shell':
                this.updateShellPhase();
                break;
        }
    }
    updateNormalLifeCycle() {
        // Check for reproduction conditions
        if (this.hunger.value < 0.2 && this.size >= 15) {
            // 1/100 chance per frame to enter egg-laying phase
            if (Math.random() < 0.001) {
                this.enterEggLayingPhase();
            }
        }
        // Check for death conditions
        if (this.hunger.value >= 1.0) {
            // 1/100 chance per frame to die
            if (Math.random() < 0.0005) {
                this.enterDyingPhase();
            }
        }
        // Check for growth
        const growthChance = (1 - this.hunger.value) / 500;
        if (Math.random() < growthChance) {
            this.grow();
        }
    }
    updateEggLayingPhase() {
        this.lifeStateCounter++;
        if (this.lifeStateCounter >= 300) {
            // Egg-laying phase complete, spawn new snail
            this.spawnNewSnail();
            // Return to normal state
            this.lifeState = 'normal';
            this.lifeStateCounter = 0;
            this.canSetGoals = true;
            this.hunger.value = Math.min(1, this.hunger.value + 0.2);
        }
    }
    updateEggPhase() {
        this.lifeStateCounter--;
        if (this.lifeStateCounter <= 0) {
            // Egg hatched, enter normal state
            this.lifeState = 'normal';
            this.lifeStateCounter = 0;
            this.canSetGoals = true;
            // Set a random goal to start moving
            this.setNewGoal();
        }
    }
    updateDyingPhase() {
        this.lifeStateCounter++;
        // Gradually decrease opacity over 1000 frames
        this.opacity = Math.max(0, 255 - (this.lifeStateCounter * 255 / 1000));
        if (this.lifeStateCounter >= 1000) {
            // Death complete, transition to shell phase
            this.enterShellPhase();
        }
    }
    updateShellPhase() {
        if (!this.shellSettled) {
            // Shell is still falling - keep full opacity
            this.opacity = 255;
            this.updateShellFalling();
        }
        else {
            // Shell has settled, fade out over 1000 frames
            this.lifeStateCounter++;
            this.opacity = Math.max(0, 255 - (this.lifeStateCounter * 255 / 1000));
            if (this.lifeStateCounter >= 1000) {
                // Shell fade complete, mark for removal
                this.markForRemoval();
            }
        }
    }
    updateShellFalling() {
        // Apply gravity to make shell fall to bottom
        const gravity = 0.5;
        this.velocity.y += gravity;
        // Apply velocity to position
        this.position.value.addInPlace(this.velocity);
        // Check if shell has reached the bottom
        const bounds = Snail.getTankBounds();
        if (this.position.value.y >= bounds.maxY - this.wallOffset) {
            // Shell has settled at the bottom
            this.shellSettled = true;
            this.lifeStateCounter = 0; // Reset counter for fade phase
            this.velocity = Vector.zero(); // Stop falling
            this.position.value.y = bounds.maxY - this.wallOffset; // Clamp to bottom
        }
    }
    enterEggLayingPhase() {
        this.lifeState = 'egg-laying';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        // Set movement speed to 0
        this.velocity = Vector.zero();
        this.acceleration = Vector.zero();
    }
    enterDyingPhase() {
        this.lifeState = 'dying';
        this.lifeStateCounter = 0;
        this.canSetGoals = false;
        // Stop moving
        this.velocity = Vector.zero();
        this.acceleration = Vector.zero();
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
        this.velocity = Vector.zero();
        this.acceleration = Vector.zero();
    }
    spawnNewSnail() {
        if (!this.tank)
            return;
        // Create new snail at size 2 near the parent
        const parentPos = this.position.value;
        const startWall = this.wall;
        const startPos = Snail.getRandomPositionOnWall(startWall, 5);
        // Ensure the new snail is close to the parent
        const offset = 20;
        startPos.x = Math.max(parentPos.x - offset, Math.min(parentPos.x + offset, startPos.x));
        startPos.y = Math.max(parentPos.y - offset, Math.min(parentPos.y + offset, startPos.y));
        startPos.z = Math.max(parentPos.z - offset, Math.min(parentPos.z + offset, startPos.z));
        const newSnail = new Snail(2); // Start at size 2
        newSnail.position.value = startPos;
        newSnail.wall = startWall;
        newSnail.setTank(this.tank);
        // Add to tank (we'll need to add a method for this)
        this.tank.addSnail(newSnail);
    }
    grow() {
        this.size += 1;
        this.hunger.value = Math.min(1, this.hunger.value + 0.05); // Increase hunger by 10%
        this.baseSpeed = 0.1 * Math.pow(this.size, 0.5); // Update base speed with new formula
        this.wallOffset = this.size / 2; // Update wall offset for new size
    }
    markForRemoval() {
        // This will be handled by the tank's update method
        // We'll add a flag to indicate the snail should be removed
        this.lifeState = 'dying';
        this.lifeStateCounter = 1000; // Ensure it stays in dying state
    }
    // Public method to check if snail should be removed
    shouldBeRemoved() {
        return (this.lifeState === 'dying' && this.lifeStateCounter >= 1000) ||
            (this.lifeState === 'shell' && this.lifeStateCounter >= 1000);
    }
    // Public method to get hunger value
    getHungerValue() {
        return this.hunger.value;
    }
    // Public method to get life state
    getLifeState() {
        return this.lifeState;
    }
    getSpriteIndexAndRotation() {
        // If snail is in shell phase, always use empty shell sprite
        if (this.lifeState === 'shell') {
            return { index: 6, rotation: 0, mirrored: false }; // Empty shell sprite
        }
        const delta = this.velocity;
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
        if (!Snail.spritesheet) {
            // Fallback to circle rendering if spritesheet not loaded
            const relativeDepth = this.position.z / tank.depth;
            const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
            const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
            const depthScale = lerp(1, 0.7, relativeDepth);
            const renderSize = this.size * depthScale;
            push();
            fill(139, 69, 19, Math.floor(this.opacity)); // Brown color for snail with opacity
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
        // Apply opacity by using tint
        if (this.opacity < 255) {
            // Note: p5.js doesn't support alpha in image() directly, so we'll use the fallback circle for dying snails
            // This ensures opacity is properly handled
            pop(); // Restore transformation state
            push();
            fill(139, 69, 19, Math.floor(this.opacity));
            noStroke();
            ellipse(0, 0, spriteWidth, spriteHeight);
        }
        else {
            image(Snail.spritesheet, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
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
