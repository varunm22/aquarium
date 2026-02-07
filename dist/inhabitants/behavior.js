import { Fish } from './fish.js';
import { Microfauna } from './microfauna.js';
import { Food } from './food.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';
export function handleNotInWater(fish) {
    fish.position.delta.y += 0.4;
    const bounds = getTankBounds();
    if (fish.position.y >= bounds.min.y) {
        fish.in_water = true;
        fish.position.setShouldConstrain(true);
        fish.position.delta.y *= 0.5;
        fish.splash = 10;
    }
    return false;
}
export function updateFactors(fish, fish_by_lateral_line) {
    fish.updateFear();
    fish.updateHunger();
    for (let other of fish_by_lateral_line) {
        if (other instanceof Fish && other.splash > 0) {
            const direction = other.position.value.subtract(fish.position.value);
            const distance = direction.magnitude();
            const splashIntensity = Math.min(0.3, 35 / distance);
            fish.increaseFear(splashIntensity, direction);
        }
    }
}
function distanceToTarget(fish, target) {
    if (target instanceof Food) {
        return fish.position.value.distanceTo(target.position.value);
    }
    return fish.distanceTo(target);
}
function isTargetInFieldOfView(fish, target, maxAngle = 45, maxDistance = 300) {
    if (target instanceof Food) {
        const disp = target.position.value.subtract(fish.position.value);
        const distance = fish.position.value.distanceTo(target.position.value);
        if (distance > maxDistance)
            return false;
        const dispMag = disp.magnitude();
        const deltaMag = fish.position.delta.magnitude();
        if (dispMag === 0 || deltaMag === 0)
            return false;
        const disp_norm = disp.divide(dispMag);
        const fish_dir = fish.position.delta.divide(deltaMag);
        const dotProduct = disp_norm.dotProduct(fish_dir);
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        return (angle * 180 / Math.PI) <= maxAngle;
    }
    return fish.isInFieldOfView(target, maxAngle, maxDistance);
}
export function scanEnvironment(fish, inhabitants, food) {
    const fish_in_view = [];
    const fish_by_lateral_line = [];
    const microfauna_in_view = [];
    const food_in_view = [];
    for (let other of inhabitants) {
        if (other !== fish) {
            if (other instanceof Fish) {
                if (fish.isInFieldOfView(other, 45, 300)) {
                    fish_in_view.push(other);
                }
                else if (fish.distanceTo(other) <= 50 || other.splash > 0) {
                    fish_by_lateral_line.push(other);
                }
            }
            else if (other instanceof Microfauna) {
                if (fish.isInFieldOfView(other, 45, 300)) {
                    // Detection scales from 0% at size 1.5 to 100% at size 3.5
                    const size = other.getSize();
                    let detectionProbability = 0;
                    if (size >= 1.5) {
                        detectionProbability = Math.min(1, (size - 1.5) / 2.0);
                    }
                    if (Math.random() < detectionProbability) {
                        microfauna_in_view.push(other);
                    }
                }
            }
        }
    }
    for (let foodParticle of food) {
        if (isTargetInFieldOfView(fish, foodParticle, 45, 300)) {
            let detectionProbability;
            if (foodParticle.settled) {
                detectionProbability = 0.001;
            }
            else if (foodParticle.floating) {
                detectionProbability = 0.001;
            }
            else {
                detectionProbability = 0.1;
            }
            if (Math.random() < detectionProbability) {
                food_in_view.push(foodParticle);
            }
        }
    }
    // Smell detection: inverse-square falloff, weighted direction averaging
    let smelled_food_direction = null;
    let totalFoodDirection = Vector.zero();
    let foodCount = 0;
    for (let foodParticle of food) {
        const distance = fish.position.value.distanceTo(foodParticle.position.value);
        let baseSmellStrength = 0;
        if (foodParticle.settled) {
            baseSmellStrength = 0.0001;
        }
        else if (foodParticle.floating) {
            baseSmellStrength = 0.0001;
        }
        else {
            baseSmellStrength = 0.10;
        }
        const distanceBasedProbability = Math.max(baseSmellStrength / (1 + distance * distance / 10000), baseSmellStrength * 0.01);
        if (Math.random() < distanceBasedProbability) {
            const direction = foodParticle.position.value.subtract(fish.position.value);
            totalFoodDirection.addInPlace(direction.multiply(distanceBasedProbability));
            foodCount++;
        }
    }
    if (foodCount > 0) {
        smelled_food_direction = totalFoodDirection.divide(foodCount);
        const magnitude = smelled_food_direction.magnitude();
        if (magnitude > 0) {
            smelled_food_direction = smelled_food_direction.divide(magnitude).multiply(0.02);
        }
    }
    return { fish_in_view, fish_by_lateral_line, microfauna_in_view, food_in_view, smelled_food_direction };
}
function applyMovement(fish, netForce, params = {}) {
    const p = Object.assign({ movementChance: 0.2, initiativeMultiplier: 2, initiativeDecay: 0.1, variance: 0.2, forceMultiplier: 10 }, params);
    const forceMagnitude = netForce.magnitude();
    fish.updateInitiative(forceMagnitude * p.initiativeMultiplier);
    if (Math.random() < Math.min(p.movementChance, fish.getInitiativeValue())) {
        const direction = netForce.divide(forceMagnitude || 1);
        const magnitude = fish.getInitiativeValue() * p.forceMultiplier * (1 + (Math.random() - 0.5) * p.variance);
        fish.position.applyAcceleration(direction.multiply(magnitude), 1);
        fish.setInitiativeValue(fish.getInitiativeValue() * p.initiativeDecay);
    }
}
function calculateNetForce(fish, fish_in_view, fish_by_lateral_line, params = {}) {
    const p = Object.assign({ attractionMultiplier: 0.005, attractionCap: 0.001, repulsionMultiplier: 0.2, repulsionCap: 0.1, randomThreshold: 0.25, randomRange: 0.01 }, params);
    let totalForce = Vector.zero();
    for (let other of fish_in_view) {
        if (other.constructor.name === 'UserFish') {
            totalForce.addInPlace(fish.calculateAttractionForce(other, 0.02, 0.0005));
        }
        else {
            const distance = fish.distanceTo(other);
            if (distance > 150) {
                totalForce.addInPlace(fish.calculateAttractionForce(other, p.attractionCap, p.attractionMultiplier));
            }
            else if (distance < 150) {
                totalForce.addInPlace(fish.calculateRepulsionForce(other, p.repulsionCap, p.repulsionMultiplier));
            }
        }
    }
    for (let other of fish_by_lateral_line) {
        if (other instanceof Fish) {
            totalForce.addInPlace(fish.calculateRepulsionForce(other, p.repulsionCap, p.repulsionMultiplier));
        }
    }
    if (fish_in_view.length === 0 && Math.random() < p.randomThreshold) {
        totalForce.addInPlace(generateConstrainedRandomVector(p.randomRange));
    }
    return totalForce;
}
function calculateFearNetForce(fish, fish_in_view, fish_by_lateral_line) {
    const fearValue = fish.getFearValue();
    const totalForce = calculateNetForce(fish, fish_in_view, fish_by_lateral_line, {
        attractionMultiplier: 0.005 + (fearValue - 0.5) * 0.05,
        randomRange: 0.5
    });
    const fearDirection = fish.getFearDirection();
    const fearMagnitude = Math.max(fearValue - 0.7, 0) * 0.05;
    totalForce.addInPlace(fearDirection.multiply(-1 * fearMagnitude));
    return totalForce;
}
export function handleFearMovement(fish, fish_in_view, fish_by_lateral_line) {
    const netForce = calculateFearNetForce(fish, fish_in_view, fish_by_lateral_line);
    applyMovement(fish, netForce, { forceMultiplier: 3 });
}
function generateConstrainedRandomVector(range) {
    const x = (Math.random() - 0.5) * range;
    const z = (Math.random() - 0.5) * range;
    const horizontalMagnitude = Math.sqrt(x * x + z * z);
    const maxY = horizontalMagnitude * 0.66;
    const y = (Math.random() - 0.5) * maxY;
    return new Vector(x, y, z);
}
export function handleHungerMovement(fish, microfauna_in_view, food_in_view) {
    if (fish.isEating())
        return;
    if (!fish.getStrikeTarget()) {
        const nearestFood = findNearestFood(fish, microfauna_in_view, food_in_view);
        if (nearestFood) {
            fish.setHungerTarget(nearestFood);
        }
        else {
            const smelledDirection = fish.getSmelledFoodDirection();
            if (smelledDirection) {
                applyMovement(fish, smelledDirection, { forceMultiplier: 2, movementChance: 0.15, variance: 0.4 });
            }
            else if (Math.random() < 0.1) {
                applyMovement(fish, generateConstrainedRandomVector(0.1));
            }
            return;
        }
    }
    let target = fish.getStrikeTarget();
    let shouldEndStrike = false;
    if (!target) {
        shouldEndStrike = true;
    }
    else if (target instanceof Microfauna) {
        if (!target.tank) {
            shouldEndStrike = true;
        }
        else if (target.tank.microfauna.indexOf(target) === -1) {
            shouldEndStrike = true;
        }
        else if (!isTargetInFieldOfView(fish, target, 45, 300) && Math.random() < 0.1) {
            shouldEndStrike = true;
        }
    }
    else if (target instanceof Food) {
        if (!target.tank) {
            shouldEndStrike = true;
        }
        else if (target.tank.food.indexOf(target) === -1) {
            shouldEndStrike = true;
        }
        else if (!isTargetInFieldOfView(fish, target, 45, 300) && Math.random() < 0.1) {
            shouldEndStrike = true;
        }
    }
    else {
        shouldEndStrike = true;
    }
    if (shouldEndStrike) {
        fish.endStrike();
        return;
    }
    if (!target) {
        fish.endStrike();
        return;
    }
    const direction = target.position.value.subtract(fish.position.value);
    const distance = direction.magnitude();
    if (!fish.isInStrike() && distance < 100) {
        fish.startStrike(target);
    }
    if (fish.isInStrike()) {
        direction.divideInPlace(distance);
        fish.position.applyAcceleration(direction.multiply(Math.max(distance * 0.002, 0.1)), 1);
    }
    else {
        const netForce = direction.divide(distance).multiply(0.01);
        applyMovement(fish, netForce);
    }
    if (distance < 10) {
        fish.endStrike();
        fish.decreaseHunger(0.1);
        fish.startEating();
        if (target instanceof Microfauna && target.tank) {
            const index = target.tank.microfauna.indexOf(target);
            if (index > -1)
                target.tank.microfauna.splice(index, 1);
        }
        else if (target instanceof Food && target.tank) {
            const index = target.tank.food.indexOf(target);
            if (index > -1)
                target.tank.food.splice(index, 1);
        }
    }
}
function findNearestFood(fish, microfauna_in_view, food_in_view) {
    let nearest = null;
    let minDistance = Infinity;
    const HUNT_RADIUS = 200;
    for (const inhabitant of microfauna_in_view) {
        if (inhabitant.constructor.name === 'Microfauna') {
            const distance = fish.distanceTo(inhabitant);
            if (distance < HUNT_RADIUS && distance < minDistance) {
                nearest = inhabitant;
                minDistance = distance;
            }
        }
    }
    for (const foodParticle of food_in_view) {
        const distance = distanceToTarget(fish, foodParticle);
        if (distance < HUNT_RADIUS && distance < minDistance) {
            nearest = foodParticle;
            minDistance = distance;
        }
    }
    return nearest;
}
export function handleNormalMovement(fish, fish_in_view, fish_by_lateral_line) {
    const netForce = calculateNetForce(fish, fish_in_view, fish_by_lateral_line);
    applyMovement(fish, netForce);
}
