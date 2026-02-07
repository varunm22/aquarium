export class Vector {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    static random(min: number, max: number): Vector {
        const randomValue = () => Math.random() * (max - min) + min;
        return new Vector(randomValue(), randomValue(), randomValue());
    }

    static zero(): Vector {
        return new Vector(0, 0, 0);
    }
  
    multiply(scalar: number): Vector {
      return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    multiplyInPlace(scalar: number): Vector {
      this.x *= scalar;
      this.y *= scalar;
      this.z *= scalar;
      return this;
    }

    divide(scalar: number): Vector {
      if (scalar === 0) throw new Error("Division by zero is not allowed.");
      return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
    }

    divideInPlace(scalar: number): Vector {
      if (scalar === 0) throw new Error("Division by zero is not allowed.");
      this.x /= scalar;
      this.y /= scalar;
      this.z /= scalar;
      return this;
    }
  
    add(other: Vector): Vector {
      return new Vector(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    addInPlace(other: Vector): Vector {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
  
    subtract(other: Vector): Vector {
      return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    subtractInPlace(other: Vector): Vector {
      this.x -= other.x;
      this.y -= other.y;
      this.z -= other.z;
      return this;
    }

    dotProduct(other: Vector): number {
      return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    constrainScalar(min: number, max: number): Vector {
      return new Vector(
        Math.max(min, Math.min(this.x, max)),
        Math.max(min, Math.min(this.y, max)),
        Math.max(min, Math.min(this.z, max))
      );
    }
    
    constrainVector(min: Vector, max: Vector): Vector {
      return new Vector(
        Math.max(min.x, Math.min(this.x, max.x)),
        Math.max(min.y, Math.min(this.y, max.y)),
        Math.max(min.z, Math.min(this.z, max.z))
      );
    }

    magnitude(): number {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    distanceTo(other: Vector): number {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dz = this.z - other.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    copy(): Vector {
        return new Vector(this.x, this.y, this.z);
    }

    normalize(): this {
        const len = this.magnitude();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }
}
