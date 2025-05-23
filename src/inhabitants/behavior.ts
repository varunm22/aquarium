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
        fish.splash = true; // Set splash to true when entering water
    }
    return false; // Skip normal behavior
}

/**
 * Updates all the fish's internal factors (fear, hunger, etc)
 */
export function updateFactors(fish: Fish): void {
    fish.updateFear();
    fish.updateHunger();
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
                } else if (fish.distanceTo(other) <= 50 || (other instanceof Fish && other.splash)) { // Check lateral line or splash
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
        attractionMultiplier: 0.0005,  // Normal attraction
        attractionCap: 0.001,          // Standard cap on attraction force
        repulsionMultiplier: 0.1,      // Standard repulsion
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

    // Handle fish detected by lateral line or splash
    for (let other of fish_by_lateral_line) {
        if (other instanceof Fish) {
            totalForce.addInPlace(fish.calculateRepulsionForce(other, finalParams.repulsionCap, finalParams.repulsionMultiplier));
            
            if (other.splash) {
                const direction = other.position.value.subtract(fish.position.value);
                const distance = direction.magnitude();
                const baseDistance = 200;
                const splashIntensity = Math.min(1, baseDistance / distance);
                const splashLocation = other.position.value.add(new Vector(0, 200, 0));
                const fearDirection = splashLocation.subtract(fish.position.value);
                fish.increaseFear(splashIntensity, fearDirection);
            }
        }
    }

    if (fish_in_view.length === 0) {
        if (Math.random() < finalParams.randomThreshold) {
            totalForce.addInPlace(Vector.random(-finalParams.randomRange, finalParams.randomRange));
        }
    }

    return totalForce;
}

/**
 * Calculates net force for a fish in fear mode
 */
function calculateFearNetForce(fish: Fish, fish_in_view: Inhabitant[], fish_by_lateral_line: Inhabitant[]): Vector {
    // Only specify parameters that differ from normal behavior
    const fearParams = {
        attractionMultiplier: 0.005,  // Stronger attraction to other fish for safety
        randomRange: 0.5               // Larger random vectors
    };

    const totalForce = calculateNetForce(fish, fish_in_view, fish_by_lateral_line, fearParams);

    // Add strong force away from fear direction, scaled by fear magnitude
    const fearDirection = fish.getFearDirection();
    if (fearDirection.magnitude() > 0) {
        // Scale the escape force by fear value (0.5 to 1.0 maps to 0.1 to 0.2)
        const fearMagnitude = (fish.getFearValue() - 0.5) * 2; // Normalize 0.5-1.0 to 0-1
        const escapeForce = fearDirection.multiply(-0.1 * (1 + fearMagnitude));
        totalForce.addInPlace(escapeForce);
    }

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
 * Applies movement based on the calculated net force and initiative
 */
function applyMovement(fish: Fish, netForce: Vector, forceMagnitude: number): void {
    // Update initiative based on force magnitude
    fish.updateInitiative(forceMagnitude * 1.5);

    // Calculate movement probability and magnitude based on initiative
    if (Math.random() < Math.min(0.25, fish.getInitiativeValue())) {
        // Normalize the force vector for direction
        const direction = netForce.divide(forceMagnitude || 1);
        
        // Calculate movement magnitude with some variance
        const baseMagnitude = fish.getInitiativeValue();
        const variance = 0.2; // 20% variance
        const magnitude = baseMagnitude * (1 + (Math.random() - 0.5) * variance);
        
        // Apply the movement
        fish.position.applyAcceleration(direction.multiply(magnitude), 1);
        
        fish.setInitiativeValue(fish.getInitiativeValue() * 0.2);
    }
}

/**
 * Handles movement for a fish in fear mode
 */
export function handleFearMovement(fish: Fish, fish_in_view: Inhabitant[], fish_by_lateral_line: Inhabitant[]): void {
    const netForce = calculateFearNetForce(fish, fish_in_view, fish_by_lateral_line);
    const forceMagnitude = netForce.magnitude();
    applyMovement(fish, netForce, forceMagnitude);
}

/**
 * Handles movement for a fish in hunger mode
 */
export function handleHungerMovement(fish: Fish, microfauna_in_view: Inhabitant[]): void {
    // If fish is currently eating, just drift
    if (fish.isEating()) {
        return;
    }

    // Get current target
    let target = fish.getStrikeTarget();

    // If no target, look for nearest food
    if (!target) {
        const nearestFood = findNearestFood(fish, microfauna_in_view);
        if (nearestFood) {
            target = nearestFood;
            fish.startStrike(target);
        } else {
            // No food found, use normal movement
            handleNormalMovement(fish, [], []);
            return;
        }
    }

    // Calculate direction and distance to target
    const direction = target.position.value.subtract(fish.position.value);
    const distance = direction.magnitude();

    // If not in strike mode and within striking distance, start strike
    if (!fish.isInStrike() && distance < 150) {
        fish.startStrike(target);
    }

    // Handle movement based on whether we're in strike mode
    if (fish.isInStrike()) {
        // When striking, use direct acceleration for precise movement
        direction.divideInPlace(distance);
        fish.position.applyAcceleration(direction.multiply(0.3), 1);
    } else {
        // When not striking, use net force to influence movement
        // This will work with the initiative system for more natural movement
        const forceMagnitude = 0.2; // Strong enough to influence movement but not override initiative
        const netForce = direction.divide(distance).multiply(forceMagnitude);
        applyMovement(fish, netForce, forceMagnitude);
    }

    // Check if caught the target
    if (distance < 20) {
        fish.endStrike();
        fish.decreaseHunger(0.03);
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
    const forceMagnitude = netForce.magnitude();
    applyMovement(fish, netForce, forceMagnitude);
} 