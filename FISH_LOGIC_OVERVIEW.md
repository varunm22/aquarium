# Fish/Ember Tetra Logic Layers Overview

## Rendering
- **Water planes**: 20 evenly spaced rectangles with minimal opacity, size scaled to distance (back to front)
- **Back-to-front rendering**: Creatures rendered between water panes based on z-depth
- **Depth-based scaling**: Position and size interpolated using lerp (size: 1.0 at front → 0.7 at back)
- **Sprite system**: 5-directional sprites (front, front-left, left, back-left, back) with mirroring based on movement direction
- **Vertical tilt**: Calculated from horizontal vs vertical velocity ratio

## Levels of Abstraction

### 1. Perception Layer
- **Visual field of view**: 45° cone, 300 unit range → `fish_in_view`, `microfauna_in_view`, `food_in_view`
- **Lateral line detection**: 50 unit radius sphere (non-visual) → `fish_by_lateral_line`, detects splashes
- **Smell system**: Distance-based probability detection for food (inverse square falloff)
  - Strengths: sinking (0.10), floating/settled (0.0001)
  - Returns averaged direction vector, decays over time (0.98/frame)

### 2. Behavioral State Machine
Three primary states with priority:
1. **Fear mode** (priority): Activated when `fear.value > 0.5`
   - Exits feeding mode immediately
   - Strong escape force away from fear direction
   - Increased attraction to other fish (safety in numbers)
   - Larger random movement vectors
2. **Hunger/Feeding mode**: Activated probabilistically based on hunger level and food presence
   - Entry probability: `hunger / 10` if food detected (sight/smell), `hunger / 200` if no food
   - Exit probability: `(1 - hunger) / 100` if no food detected
   - Handles strike/eating mechanics
3. **Normal mode**: Default schooling behavior
   - Attraction/repulsion forces based on distance to other fish
   - Random movement when no fish in view

### 3. Force Calculation System
- **Attraction**: Pull towards other fish when distance > 150 (`distance * 0.005`, capped at 0.001)
- **Repulsion**: Push away when distance < 150 or lateral line detected (`-0.2 / distance²`, capped at 0.1)
- **Random**: Applied when no fish in view (25% chance, constrained vertical movement)
- **Fear escape**: Force away from fear source (`(fear - 0.7) * 0.05` when fear > 0.7)

### 4. Initiative System
- **Build-up**: Increases proportional to net force magnitude (`forceMagnitude * 2.0`, constrained [0, 1])
- **Movement probability**: `min(0.2, initiativeValue)` - higher initiative = higher chance
- **Movement magnitude**: `initiativeValue * 10` with ±20% variance - higher initiative = larger movement
- **Decay**: Reduced to 90% after movement
- **Execution**: Single-frame acceleration in direction of net vector

### 5. Position/Physics System
- **Velocity decay**: `delta *= 0.96` per frame (damping in water)
- **Wall avoidance**: Proactive force when within 50 units of walls (proportional to `velocity / distance`)
- **Boundary constraints**: Hard limits with velocity/acceleration reflection on collision
- **Acceleration**: Temporary acceleration with duration (clears automatically)
- **Water entry**: Constant downward acceleration (0.4), velocity halved on entry, splash counter (10 frames)

### 6. Hunger System
- **Passive increase**: `hunger += 0.0003` per frame
- **Feeding mode**: Probabilistic entry/exit based on hunger level and food presence
- **Strike**: Activated when target within 100 units (direct acceleration, bypasses initiative)
- **Eating**: Triggered when distance < 10 units (hunger -0.1, animation 10 frames, target removed)
- **Smell tracking**: Direction vector decays (0.98/frame), cleared on fear activation

### 7. Fear System
- **Passive decay**: Linear decay (0.002 per frame)
- **Splash detection**: Nearby fish splashes increase fear (`min(0.3, 35 / distance)`)
- **Response**: Overrides all other behaviors when `fear > 0.5`

### 8. Update Loop Flow
```
1. Update splash counter → Handle not-in-water state
2. Scan environment (visual, lateral line, smell)
3. Update factors (fear decay/splash, hunger increase/feeding mode)
4. Determine behavior state (Fear > Hunger > Normal)
5. Calculate net force → Apply movement via initiative → Update position
```


## Key Design Patterns

1. **Factor System**: Unified update pattern (`value += delta`, `delta += ddelta`) for Position, Initiative, Fear, Hunger
2. **Separation of Concerns**: `behavior.ts` (force calculation), `fish.ts` (state management), `factor.ts` (individual logic)
3. **Probabilistic Behaviors**: Probability-based decisions (feeding mode, food detection, random movement)
4. **Force Accumulation**: Net force = sum of all forces (attraction + repulsion + random + fear + hunger)
5. **State Priority**: Fear > Hunger > Normal (survival overrides feeding)
