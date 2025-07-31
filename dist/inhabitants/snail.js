import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { TANK_CONSTANTS } from '../constants.js';
export class Snail extends Inhabitant {
    constructor(size = 20) {
        const startWall = Snail.getRandomWall();
        const startPos = Snail.getRandomPositionOnWall(startWall, 5);
        super(new Position(startPos, new Vector(0, 0, 0), false), size);
        this.path = [];
        this.goal = null;
        this.baseSpeed = 0.03 * this.size;
        this.wallOffset = this.size / 2;
        this.velocity = Vector.zero(); // Current velocity vector
        this.acceleration = Vector.zero(); // Current acceleration vector
        this.coveredAlgaePositions = new Set(); // Track algae positions we've covered
        this.tank = null;
        this.eatingCounter = 0; // Counter for eating algae, affects speed
        this.goalReEvaluationChance = 0.001; // Very small chance to re-evaluate goal each frame
        this.frameCounter = 0; // Frame counter for performance optimizations
        this.ALGAE_INTERACTION_INTERVAL = 5; // Only check algae every 5 frames
        this.wall = startWall;
        this.wallOffset = 5;
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
                // Try to find algae target if no settled food
                const pos = this.position.value;
                const algaeTarget = this.tank.algae.findBestAlgaeTarget(pos.x, pos.y, pos.z, 600);
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
                }
                else {
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
        this.path = this.generatePath(this.position.value, this.goal);
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
    getProjectedDistanceToGoal() {
        if (!this.goal)
            return 0;
        const pos = this.position.value;
        const toGoal = this.goal.copy().subtractInPlace(pos);
        let projectedToGoal;
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
    findDistantGoal() {
        const pos = this.position.value;
        const bounds = Snail.getTankBounds();
        const minDistance = 20;
        let bestGoal = null;
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
        const walls = ['front', 'back', 'left', 'right', 'bottom'];
        const shuffledWalls = walls.sort(() => random() - 0.5); // Shuffle walls
        for (const wall of shuffledWalls) {
            // Try multiple random positions on this wall
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidateGoal = Snail.getRandomPositionOnWall(wall, this.wallOffset);
                // Calculate projected distance to this goal
                const toGoal = candidateGoal.copy().subtractInPlace(pos);
                let projectedToGoal;
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
        let fallbackGoal;
        switch (this.wall) {
            case 'front':
                fallbackGoal = new Vector(pos.x + (random() > 0.5 ? minDistance : -minDistance), pos.y + (random() > 0.5 ? minDistance : -minDistance), bounds.minZ + this.wallOffset);
                break;
            case 'back':
                fallbackGoal = new Vector(pos.x + (random() > 0.5 ? minDistance : -minDistance), pos.y + (random() > 0.5 ? minDistance : -minDistance), bounds.maxZ - this.wallOffset);
                break;
            case 'left':
                fallbackGoal = new Vector(bounds.minX + this.wallOffset, pos.y + (random() > 0.5 ? minDistance : -minDistance), pos.z + (random() > 0.5 ? minDistance : -minDistance));
                break;
            case 'right':
                fallbackGoal = new Vector(bounds.maxX - this.wallOffset, pos.y + (random() > 0.5 ? minDistance : -minDistance), pos.z + (random() > 0.5 ? minDistance : -minDistance));
                break;
            case 'bottom':
                fallbackGoal = new Vector(pos.x + (random() > 0.5 ? minDistance : -minDistance), bounds.maxY - this.wallOffset, pos.z + (random() > 0.5 ? minDistance : -minDistance));
                break;
        }
        // Clamp the fallback goal to tank bounds
        fallbackGoal.x = Math.max(bounds.minX, Math.min(bounds.maxX, fallbackGoal.x));
        fallbackGoal.y = Math.max(bounds.minY, Math.min(bounds.maxY, fallbackGoal.y));
        fallbackGoal.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, fallbackGoal.z));
        return fallbackGoal;
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
    findLocalAlgaeCluster(center) {
        if (!this.tank || this.wall === 'bottom')
            return null;
        const searchRadius = 15; // 30x30 square = 15 pixel radius
        const gridSize = 4; // Algae square size
        const clusterMap = new Map();
        // Optimized: Only check 2D grid positions on the current wall
        // This reduces complexity from O(n³) to O(n²)
        const wallBounds = this.getWallBounds();
        const minX = Math.max(wallBounds.minX, center.x - searchRadius);
        const maxX = Math.min(wallBounds.maxX, center.x + searchRadius);
        const minY = Math.max(wallBounds.minY, center.y - searchRadius);
        const maxY = Math.min(wallBounds.maxY, center.y + searchRadius);
        // Step by grid size to avoid checking every pixel
        for (let x = Math.floor(minX / gridSize) * gridSize; x <= maxX; x += gridSize) {
            for (let y = Math.floor(minY / gridSize) * gridSize; y <= maxY; y += gridSize) {
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
                const checkPos = new Vector(x, y, z);
                const distance = center.distanceTo(checkPos);
                // Only check if within search radius
                if (distance <= searchRadius) {
                    const algaeLevel = this.tank.algae.getAlgaeLevel(this.wall, checkPos.x, checkPos.y, checkPos.z);
                    if (algaeLevel > 0) {
                        // Group into 8x8 pixel clusters for performance
                        const clusterSize = 8;
                        const clusterX = Math.floor(checkPos.x / clusterSize) * clusterSize;
                        const clusterY = Math.floor(checkPos.y / clusterSize) * clusterSize;
                        const clusterZ = Math.floor(checkPos.z / clusterSize) * clusterSize;
                        const clusterKey = `${clusterX}-${clusterY}-${clusterZ}`;
                        if (clusterMap.has(clusterKey)) {
                            const cluster = clusterMap.get(clusterKey);
                            cluster.strength += algaeLevel;
                            cluster.count++;
                            // Update center to weighted average
                            cluster.x = (cluster.x * (cluster.count - 1) + checkPos.x) / cluster.count;
                            cluster.y = (cluster.y * (cluster.count - 1) + checkPos.y) / cluster.count;
                            cluster.z = (cluster.z * (cluster.count - 1) + checkPos.z) / cluster.count;
                        }
                        else {
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
        let bestCluster = null;
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
            return [
                { position: edgePoint, wall: endWall },
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
        if (this.path.length === 0) {
            this.setNewGoal();
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
        // Very small chance to re-evaluate goal each frame
        if (Math.random() < this.goalReEvaluationChance) {
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
                this.setNewGoal();
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
        const searchRadius = this.size / 3;
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
                    // Increase eating counter by algae level (max 200)
                    this.eatingCounter = Math.min(200, this.eatingCounter + algaeLevel * 3);
                }
            }
        }
    }
    handleFoodInteraction(tank) {
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
    getSpriteIndexAndRotation() {
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
        image(Snail.spritesheet, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
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
