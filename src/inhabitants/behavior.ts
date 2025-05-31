import { Inhabitant } from './inhabitant.js';
import { Fish } from './fish.js';
import { Microfauna } from './microfauna.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';

/**
 * Handles the behavior of a fish that is not in water
 * Returns true if the fish should continue with normal behavior, false if it should skip normal behavior
 */
export function handleNotInWater(fish: Fish): boolean {
    // Apply constant downward acceleration
    fish.position.delta.y += 0.4; // Add to velocity directly
    
    // Check if fish has reached the water surface using tank bounds
    const bounds = getTankBounds();
    if (fish.position.y >= bounds.min.y) {
        fish.in_water = true;
        fish.position.setShouldConstrain(true); // Enable constraints when entering water
        fish.position.delta.y *= 0.5 // slow down when entering water
        fish.splash = 10; // Set splash counter to 10 frames
    }
    return false; // Skip normal behavior
}

/**
 * Updates all the fish's internal factors (fear, hunger, etc)
 */
export function updateFactors(fish: Fish, fish_by_lateral_line: Inhabitant[]): void {
    fish.updateFear();
    fish.updateHunger();

    // Check for splashes from nearby fish
    for (let other of fish_by_lateral_line) {
        if (other instanceof Fish && other.splash > 0) {
            const direction = other.position.value.subtract(fish.position.value);
            const distance = direction.magnitude();
            const baseDistance = 35;
            const splashIntensity = Math.min(0.3, baseDistance / distance);
            fish.increaseFear(splashIntensity, direction);
        }
    }
}

/**
 * Scans the environment for other inhabitants and categorizes them
 */
export function scanEnvironment(fish: Fish, inhabitants: Inhabitant[]): {
    fish_in_view: Inhabitant[],
    fish_by_lateral_line: Inhabitant[],
    microfauna_in_view: Inhabitant[]
} {
    const fish_in_view: Inhabitant[] = [];
    const fish_by_lateral_line: Inhabitant[] = [];
    const microfauna_in_view: Inhabitant[] = [];
    
    for (let other of inhabitants) {
        if (other !== fish) {
            if (other instanceof Fish) {  // Handle fish
                if (fish.isInFieldOfView(other, 45, 300)) {
                    fish_in_view.push(other);
                } else if (fish.distanceTo(other) <= 50 || other.splash > 0) { // Check lateral line or splash
                    fish_by_lateral_line.push(other);
                }
            } else if (other.constructor.name === 'Microfauna') {  // Handle microfauna
                if (fish.isInFieldOfView(other, 45, 300)) {
                    microfauna_in_view.push(other);
                }
            }
        }
    }
    return { fish_in_view, fish_by_lateral_line, microfauna_in_view };
}

/**
 * Applies movement based on the calculated net force and initiative
 */
function applyMovement(
    fish: Fish, 
    netForce: Vector, 
    params: {
        movementChance?: number,
        initiativeMultiplier?: number,
        initiativeDecay?: number,
        variance?: number,
        forceMultiplier?: number
    } = {}
): void {
    // Default parameters
    const defaultParams = {
        movementChance: 0.2,         // Base chance of movement
        initiativeMultiplier: 2,     // How much force magnitude affects initiative
        initiativeDecay: 0.1,        // How much initiative decreases after movement
        variance: 0.2,                // Variance in movement magnitude
        forceMultiplier: 10          // How much we multiply initiative to get force magnitude
    };

    // Merge default parameters with provided parameters
    const finalParams = { ...defaultParams, ...params };

    // Update initiative based on force magnitude
    const forceMagnitude = netForce.magnitude();
    fish.updateInitiative(forceMagnitude * finalParams.initiativeMultiplier);

    // Calculate movement probability and magnitude based on initiative
    if (Math.random() < Math.min(finalParams.movementChance, fish.getInitiativeValue())) {
        // Normalize the force vector for direction
        const direction = netForce.divide(forceMagnitude || 1);
        
        // Calculate movement magnitude with some variance
        const baseMagnitude = fish.getInitiativeValue() * finalParams.forceMultiplier;
        const magnitude = baseMagnitude * (1 + (Math.random() - 0.5) * finalParams.variance);
        
        // Apply the movement
        fish.position.applyAcceleration(direction.multiply(magnitude), 1);
        
        fish.setInitiativeValue(fish.getInitiativeValue() * finalParams.initiativeDecay);
    }
}

/**
 * Base function for calculating net force based on environment and behavior parameters
 */
function calculateNetForce(
    fish: Fish,
    fish_in_view: Inhabitant[],
    fish_by_lateral_line: Inhabitant[],
    params: {
        attractionMultiplier?: number,
        attractionCap?: number,
        repulsionMultiplier?: number,
        repulsionCap?: number,
        randomThreshold?: number,
        randomRange?: number
    } = {}
): Vector {
    // Default parameters for normal behavior
    const defaultParams = {
        attractionMultiplier: 0.005,  // Normal attraction
        attractionCap: 0.001,          // Standard cap on attraction force
        repulsionMultiplier: 0.2,      // Standard repulsion
        repulsionCap: 0.1,            // Standard repulsion cap
        randomThreshold: 0.25,        // Normal chance of random movement
        randomRange: 0.01             // Normal random vectors
    };

    // Merge default parameters with provided parameters
    const finalParams = { ...defaultParams, ...params };

    let totalForce = Vector.zero();

    // Handle fish in visual range
    for (let other of fish_in_view) {
        if (other.constructor.name === 'UserFish') {
            // weak attraction to user fish
            totalForce.addInPlace(fish.calculateAttractionForce(other, 0.02, 0.0005));
        } else {
            const distance = fish.distanceTo(other);
            if (distance > 150) {
                totalForce.addInPlace(fish.calculateAttractionForce(other, finalParams.attractionCap, finalParams.attractionMultiplier));
            } else if (distance < 150) {
                totalForce.addInPlace(fish.calculateRepulsionForce(other, finalParams.repulsionCap, finalParams.repulsionMultiplier));
            }
        }
    }

    // Handle fish detected by lateral line
    for (let other of fish_by_lateral_line) {
        if (other instanceof Fish) {
            totalForce.addInPlace(fish.calculateRepulsionForce(other, finalParams.repulsionCap, finalParams.repulsionMultiplier));
        }
    }

    if (fish_in_view.length === 0) {
        if (Math.random() < finalParams.randomThreshold) {
            totalForce.addInPlace(generateConstrainedRandomVector(finalParams.randomRange));
        }
    }

    return totalForce;
}

/**
 * Calculates net force for a fish in fear mode
 */
function calculateFearNetForce(fish: Fish, fish_in_view: Inhabitant[], fish_by_lateral_line: Inhabitant[]): Vector {
    // Only specify parameters that differ from normal behavior
    const fearValue = fish.getFearValue();
    const attractionMultiplier = 0.005 + (fearValue - 0.5) * 0.05
    const fearParams = {
        attractionMultiplier: attractionMultiplier,  // Stronger attraction to other fish for safety
        randomRange: 0.5                             // Larger random vectors
    };

    const totalForce = calculateNetForce(fish, fish_in_view, fish_by_lateral_line, fearParams);

    // Add strong force away from fear direction, scaled by fear magnitude
    const fearDirection = fish.getFearDirection();
    // Scale the escape force by fear value (0.5 to 1.0 maps to 0.1 to 0.2)
    const fearMagnitude = Math.max(fearValue - 0.7, 0) * 0.05
    // const fearMagnitude = (fish.getFearValue() - 0.5) * 2; // Normalize 0.5-1.0 to 0-1
    const escapeForce = fearDirection.multiply(-1 * fearMagnitude);
    totalForce.addInPlace(escapeForce);
    return totalForce;
}

/**
 * Calculates net force for a fish in normal mode
 */
function calculateNormalNetForce(fish: Fish, fish_in_view: Inhabitant[], fish_by_lateral_line: Inhabitant[]): Vector {
    // Use default parameters
    return calculateNetForce(fish, fish_in_view, fish_by_lateral_line);
}

/**
 * Handles movement for a fish in fear mode
 */
export function handleFearMovement(fish: Fish, fish_in_view: Inhabitant[], fish_by_lateral_line: Inhabitant[]): void {
    const netForce = calculateFearNetForce(fish, fish_in_view, fish_by_lateral_line);
    const params = {
        forceMultiplier: 3,
    }
    applyMovement(fish, netForce, params);
}

/**
 * Generates a random vector with constrained vertical movement
 * The vertical (y) component will be at most half the magnitude of the horizontal (x,z) components
 */
function generateConstrainedRandomVector(range: number): Vector {
    const x = (Math.random() - 0.5) * range;
    const z = (Math.random() - 0.5) * range;
    const horizontalMagnitude = Math.sqrt(x * x + z * z);
    const maxY = horizontalMagnitude * 0.66;
    const y = (Math.random() - 0.5) * maxY;
    return new Vector(x, y, z);
}

/**
 * Handles movement for a fish in hunger mode
 */
export function handleHungerMovement(fish: Fish, microfauna_in_view: Inhabitant[]): void {
    // If fish is currently eating, just drift
    if (fish.isEating()) {
        return;
    }

    // If no target, look for nearest food
    if (!fish.getStrikeTarget()) {
        // Add random movement before searching for food
        if (Math.random() < 0.1) {
            const randomForce = generateConstrainedRandomVector(0.1);
            applyMovement(fish, randomForce);
        }
        const nearestFood = findNearestFood(fish, microfauna_in_view);
        if (nearestFood) {
            fish.setHungerTarget(nearestFood);
        } else {
            // No food found
            return;
        }
    }

    // If we have a target, verify it still exists in the tank and is in sight
    let target = fish.getStrikeTarget();
    let shouldEndStrike = false;

    // Check if target is valid and in tank
    if (!target || !(target instanceof Microfauna && target.tank)) {
        shouldEndStrike = true;
    } else {
        const index = target.tank.microfauna.indexOf(target);
        if (index === -1) {
            shouldEndStrike = true;
        } else {
            // Check if target is out of sight with 0.1 chance to end strike
            if (!fish.isInFieldOfView(target as Inhabitant, 45, 300) && Math.random() < 0.1) {
                shouldEndStrike = true;
            }
        }
    }

    if (shouldEndStrike) {
        fish.endStrike();
        return;
    }

    // Calculate direction and distance to target
    const direction = (target as Inhabitant).position.value.subtract(fish.position.value);
    const distance = direction.magnitude();

    // If not in strike mode and within striking distance, start strike
    if (!fish.isInStrike() && distance < 100) {
        fish.startStrike(target as Inhabitant);
    }

    // Handle movement based on whether we're in strike mode
    if (fish.isInStrike()) {
        // When striking, use direct acceleration for precise movement
        direction.divideInPlace(distance);
        fish.position.applyAcceleration(direction.multiply(Math.max(distance * 0.002, 0.1)), 1);
    } else {
        // When not striking, use net force to influence movement
        // This will work with the initiative system for more natural movement
        const forceMagnitude = 0.01; // Strong enough to influence movement but not override initiative
        const netForce = direction.divide(distance).multiply(forceMagnitude);
        applyMovement(fish, netForce);
    }

    // Check if caught the target
    if (distance < 20) {
        fish.endStrike();
        fish.decreaseHunger(0.3);
        fish.startEating();
        
        // Remove the target from the tank
        if (target instanceof Microfauna && target.tank) {
            const index = target.tank.microfauna.indexOf(target);
            if (index > -1) {
                target.tank.microfauna.splice(index, 1);
            }
        }
    }
}

/**
 * Finds the nearest food source within the fish's field of view
 */
function findNearestFood(fish: Fish, fish_in_view: Inhabitant[]): Inhabitant | null {
    let nearest: Inhabitant | null = null;
    let minDistance = Infinity;
    const HUNT_RADIUS = 200; // Maximum distance to detect food

    for (const inhabitant of fish_in_view) {
        if (inhabitant.constructor.name === 'Microfauna') {
            const distance = fish.distanceTo(inhabitant);
            if (distance < HUNT_RADIUS && distance < minDistance) {
                nearest = inhabitant;
                minDistance = distance;
            }
        }
    }

    return nearest;
}

/**
 * Handles movement for a fish in normal mode
 */
export function handleNormalMovement(fish: Fish, fish_in_view: Inhabitant[], fish_by_lateral_line: Inhabitant[]): void {
    const netForce = calculateNormalNetForce(fish, fish_in_view, fish_by_lateral_line);
    applyMovement(fish, netForce);
} 