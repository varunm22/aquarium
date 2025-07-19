import { Fish } from './fish.js';
import { Microfauna } from './microfauna.js';
import { Food } from './food.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';
/**
 * Handles the behavior of a fish that is not in water
 * Returns true if the fish should continue with normal behavior, false if it should skip normal behavior
 */
export function handleNotInWater(fish) {
    // Apply constant downward acceleration
    fish.position.delta.y += 0.4; // Add to velocity directly
    // Check if fish has reached the water surface using tank bounds
    const bounds = getTankBounds();
    if (fish.position.y >= bounds.min.y) {
        fish.in_water = true;
        fish.position.setShouldConstrain(true); // Enable constraints when entering water
        fish.position.delta.y *= 0.5; // slow down when entering water
        fish.splash = 10; // Set splash counter to 10 frames
    }
    return false; // Skip normal behavior
}
/**
 * Updates all the fish's internal factors (fear, hunger, etc)
 */
export function updateFactors(fish, fish_by_lateral_line) {
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
// Helper function to calculate distance between fish and food/inhabitant
function distanceToTarget(fish, target) {
    if (target instanceof Food) {
        return fish.position.value.distanceTo(target.position.value);
    }
    else {
        return fish.distanceTo(target);
    }
}
// Helper function to check if target is in field of view
function isTargetInFieldOfView(fish, target, maxAngle = 45, maxDistance = 300) {
    if (target instanceof Food) {
        // Replicate the field of view logic for Food
        const disp = target.position.value.subtract(fish.position.value);
        const distance = fish.position.value.distanceTo(target.position.value);
        if (distance > maxDistance)
            return false;
        const disp_norm = disp.divide(disp.magnitude());
        const fish_dir = fish.position.delta.divide(fish.position.delta.magnitude());
        const dotProduct = disp_norm.dotProduct(fish_dir);
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct))); // Clamp to prevent NaN
        const angleDegrees = (angle * 180) / Math.PI;
        return angleDegrees <= maxAngle;
    }
    else {
        return fish.isInFieldOfView(target, maxAngle, maxDistance);
    }
}
/**
 * Scans the environment for other inhabitants and categorizes them
 */
export function scanEnvironment(fish, inhabitants, food) {
    const fish_in_view = [];
    const fish_by_lateral_line = [];
    const microfauna_in_view = [];
    const food_in_view = [];
    for (let other of inhabitants) {
        if (other !== fish) {
            if (other instanceof Fish) { // Handle fish
                if (fish.isInFieldOfView(other, 45, 300)) {
                    fish_in_view.push(other);
                }
                else if (fish.distanceTo(other) <= 50 || other.splash > 0) { // Check lateral line or splash
                    fish_by_lateral_line.push(other);
                }
            }
            else if (other instanceof Microfauna) { // Handle microfauna
                if (fish.isInFieldOfView(other, 45, 300)) {
                    // Apply size-based detection probability
                    // No detection from size 1.0 to 1.5, then scale from 0% at size 1.5 to 100% at size 3.5
                    const size = other.getSize();
                    let detectionProbability = 0;
                    if (size >= 1.5) {
                        // Scale from 0% at size 1.5 to 100% at size 3.5
                        detectionProbability = Math.min(1, (size - 1.5) / (3.5 - 1.5));
                    }
                    if (Math.random() < detectionProbability) {
                        microfauna_in_view.push(other);
                    }
                }
            }
        }
    }
    // Check food particles for visual detection
    for (let foodParticle of food) {
        if (isTargetInFieldOfView(fish, foodParticle, 45, 300)) {
            let detectionProbability;
            if (foodParticle.settled) {
                detectionProbability = 0.001; // 0.1% chance for settled food
            }
            else if (foodParticle.floating) {
                detectionProbability = 0.001; // 0.1% chance for floating food
            }
            else {
                detectionProbability = 0.1; // 10% chance for sinking food
            }
            if (Math.random() < detectionProbability) {
                food_in_view.push(foodParticle);
            }
        }
    }
    // Calculate smelled food direction (separate from visual detection)
    let smelled_food_direction = null;
    let totalFoodDirection = Vector.zero();
    let foodCount = 0;
    for (let foodParticle of food) {
        const distance = fish.position.value.distanceTo(foodParticle.position.value);
        // Base smell strength based on food state
        let baseSmellStrength = 0;
        if (foodParticle.settled) {
            baseSmellStrength = 0.0001; // Very weak smell from settled food
        }
        else if (foodParticle.floating) {
            baseSmellStrength = 0.0001; // Moderate smell from floating food
        }
        else {
            baseSmellStrength = 0.10; // Strong smell from sinking food (fresh)
        }
        // Distance-based probability: smell detection decreases with distance
        // Using inverse square law-like falloff but capped to prevent extremely low probabilities
        const distanceBasedProbability = Math.max(baseSmellStrength / (1 + distance * distance / 10000), baseSmellStrength * 0.01);
        // Random chance to detect the smell based on distance
        if (Math.random() < distanceBasedProbability) {
            const direction = foodParticle.position.value.subtract(fish.position.value);
            // Weight the direction by the detection strength
            totalFoodDirection.addInPlace(direction.multiply(distanceBasedProbability));
            foodCount++;
        }
    }
    // Average the direction if multiple food sources detected
    if (foodCount > 0) {
        smelled_food_direction = totalFoodDirection.divide(foodCount);
        // Normalize to a very gentle magnitude for subtle movement
        const magnitude = smelled_food_direction.magnitude();
        if (magnitude > 0) {
            smelled_food_direction = smelled_food_direction.divide(magnitude).multiply(0.02);
        }
    }
    return { fish_in_view, fish_by_lateral_line, microfauna_in_view, food_in_view, smelled_food_direction };
}
/**
 * Applies movement based on the calculated net force and initiative
 */
function applyMovement(fish, netForce, params = {}) {
    // Default parameters
    const defaultParams = {
        movementChance: 0.2, // Base chance of movement
        initiativeMultiplier: 2, // How much force magnitude affects initiative
        initiativeDecay: 0.1, // How much initiative decreases after movement
        variance: 0.2, // Variance in movement magnitude
        forceMultiplier: 10 // How much we multiply initiative to get force magnitude
    };
    // Merge default parameters with provided parameters
    const finalParams = Object.assign(Object.assign({}, defaultParams), params);
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
function calculateNetForce(fish, fish_in_view, fish_by_lateral_line, params = {}) {
    // Default parameters for normal behavior
    const defaultParams = {
        attractionMultiplier: 0.005, // Normal attraction
        attractionCap: 0.001, // Standard cap on attraction force
        repulsionMultiplier: 0.2, // Standard repulsion
        repulsionCap: 0.1, // Standard repulsion cap
        randomThreshold: 0.25, // Normal chance of random movement
        randomRange: 0.01 // Normal random vectors
    };
    // Merge default parameters with provided parameters
    const finalParams = Object.assign(Object.assign({}, defaultParams), params);
    let totalForce = Vector.zero();
    // Handle fish in visual range
    for (let other of fish_in_view) {
        if (other.constructor.name === 'UserFish') {
            // weak attraction to user fish
            totalForce.addInPlace(fish.calculateAttractionForce(other, 0.02, 0.0005));
        }
        else {
            const distance = fish.distanceTo(other);
            if (distance > 150) {
                totalForce.addInPlace(fish.calculateAttractionForce(other, finalParams.attractionCap, finalParams.attractionMultiplier));
            }
            else if (distance < 150) {
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
function calculateFearNetForce(fish, fish_in_view, fish_by_lateral_line) {
    // Only specify parameters that differ from normal behavior
    const fearValue = fish.getFearValue();
    const attractionMultiplier = 0.005 + (fearValue - 0.5) * 0.05;
    const fearParams = {
        attractionMultiplier: attractionMultiplier, // Stronger attraction to other fish for safety
        randomRange: 0.5 // Larger random vectors
    };
    const totalForce = calculateNetForce(fish, fish_in_view, fish_by_lateral_line, fearParams);
    // Add strong force away from fear direction, scaled by fear magnitude
    const fearDirection = fish.getFearDirection();
    // Scale the escape force by fear value (0.5 to 1.0 maps to 0.1 to 0.2)
    const fearMagnitude = Math.max(fearValue - 0.7, 0) * 0.05;
    // const fearMagnitude = (fish.getFearValue() - 0.5) * 2; // Normalize 0.5-1.0 to 0-1
    const escapeForce = fearDirection.multiply(-1 * fearMagnitude);
    totalForce.addInPlace(escapeForce);
    return totalForce;
}
/**
 * Calculates net force for a fish in normal mode
 */
function calculateNormalNetForce(fish, fish_in_view, fish_by_lateral_line) {
    // Use default parameters
    return calculateNetForce(fish, fish_in_view, fish_by_lateral_line);
}
/**
 * Handles movement for a fish in fear mode
 */
export function handleFearMovement(fish, fish_in_view, fish_by_lateral_line) {
    const netForce = calculateFearNetForce(fish, fish_in_view, fish_by_lateral_line);
    const params = {
        forceMultiplier: 3,
    };
    applyMovement(fish, netForce, params);
}
/**
 * Generates a random vector with constrained vertical movement
 * The vertical (y) component will be at most half the magnitude of the horizontal (x,z) components
 */
function generateConstrainedRandomVector(range) {
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
export function handleHungerMovement(fish, microfauna_in_view, food_in_view) {
    // If fish is currently eating, just drift
    if (fish.isEating()) {
        return;
    }
    // If no target, look for nearest food
    if (!fish.getStrikeTarget()) {
        const nearestFood = findNearestFood(fish, microfauna_in_view, food_in_view);
        if (nearestFood) {
            fish.setHungerTarget(nearestFood);
        }
        else {
            // No specific food target, but check if we have a general smell direction
            const smelledDirection = fish.getSmelledFoodDirection();
            if (smelledDirection) {
                // Move gently towards the smelled food direction (very subtle influence)
                applyMovement(fish, smelledDirection, {
                    forceMultiplier: 2,
                    movementChance: 0.15,
                    variance: 0.4 // Add more randomness to make it feel natural
                });
            }
            else {
                // Add random movement while searching for food
                if (Math.random() < 0.1) {
                    const randomForce = generateConstrainedRandomVector(0.1);
                    applyMovement(fish, randomForce);
                }
            }
            return;
        }
    }
    // If we have a target, verify it still exists in the tank and is in sight
    let target = fish.getStrikeTarget();
    let shouldEndStrike = false;
    // Check if target is valid and in tank
    if (!target) {
        shouldEndStrike = true;
    }
    else if (target instanceof Microfauna) {
        if (!target.tank) {
            shouldEndStrike = true;
        }
        else {
            const index = target.tank.microfauna.indexOf(target);
            if (index === -1) {
                shouldEndStrike = true;
            }
            else {
                // Check if target is out of sight with 0.1 chance to end strike
                if (!isTargetInFieldOfView(fish, target, 45, 300) && Math.random() < 0.1) {
                    shouldEndStrike = true;
                }
            }
        }
    }
    else if (target instanceof Food) {
        if (!target.tank) {
            shouldEndStrike = true;
        }
        else {
            const index = target.tank.food.indexOf(target);
            if (index === -1) {
                shouldEndStrike = true;
            }
            else {
                // Check if target is out of sight with 0.1 chance to end strike
                if (!isTargetInFieldOfView(fish, target, 45, 300) && Math.random() < 0.1) {
                    shouldEndStrike = true;
                }
            }
        }
    }
    else {
        shouldEndStrike = true;
    }
    if (shouldEndStrike) {
        fish.endStrike();
        return;
    }
    // At this point, target is guaranteed to be non-null due to the checks above
    if (!target) {
        fish.endStrike();
        return;
    }
    const direction = target.position.value.subtract(fish.position.value);
    const distance = direction.magnitude();
    // If not in strike mode and within striking distance, start strike
    if (!fish.isInStrike() && distance < 100) {
        fish.startStrike(target);
    }
    // Handle movement based on whether we're in strike mode
    if (fish.isInStrike()) {
        // When striking, use direct acceleration for precise movement
        direction.divideInPlace(distance);
        fish.position.applyAcceleration(direction.multiply(Math.max(distance * 0.002, 0.1)), 1);
    }
    else {
        // When not striking, use net force to influence movement
        // This will work with the initiative system for more natural movement
        const forceMagnitude = 0.01; // Strong enough to influence movement but not override initiative
        const netForce = direction.divide(distance).multiply(forceMagnitude);
        applyMovement(fish, netForce);
    }
    // Check if caught the target
    if (distance < 10) {
        fish.endStrike();
        fish.decreaseHunger(0.1);
        fish.startEating();
        // Remove the target from the tank
        if (target instanceof Microfauna && target.tank) {
            const index = target.tank.microfauna.indexOf(target);
            if (index > -1) {
                target.tank.microfauna.splice(index, 1);
            }
        }
        else if (target instanceof Food && target.tank) {
            const index = target.tank.food.indexOf(target);
            if (index > -1) {
                target.tank.food.splice(index, 1);
            }
        }
    }
}
/**
 * Finds the nearest food source within the fish's field of view
 */
function findNearestFood(fish, microfauna_in_view, food_in_view) {
    let nearest = null;
    let minDistance = Infinity;
    const HUNT_RADIUS = 200; // Maximum distance to detect food
    // Check microfauna
    for (const inhabitant of microfauna_in_view) {
        if (inhabitant.constructor.name === 'Microfauna') {
            const distance = fish.distanceTo(inhabitant);
            if (distance < HUNT_RADIUS && distance < minDistance) {
                nearest = inhabitant;
                minDistance = distance;
            }
        }
    }
    // Check food particles
    for (const foodParticle of food_in_view) {
        const distance = distanceToTarget(fish, foodParticle);
        if (distance < HUNT_RADIUS && distance < minDistance) {
            nearest = foodParticle;
            minDistance = distance;
        }
    }
    return nearest;
}
/**
 * Handles movement for a fish in normal mode
 */
export function handleNormalMovement(fish, fish_in_view, fish_by_lateral_line) {
    const netForce = calculateNormalNetForce(fish, fish_in_view, fish_by_lateral_line);
    applyMovement(fish, netForce);
}
