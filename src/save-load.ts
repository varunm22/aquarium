import { Tank } from './tank.js';
import { EmberTetra } from './inhabitants/embertetra.js';
import { Snail, SnailLifeState } from './inhabitants/snail.js';
import { Microfauna } from './inhabitants/microfauna.js';
import { Food } from './inhabitants/food.js';
import { EggClump } from './inhabitants/egg_clump.js';
import { Fish } from './inhabitants/fish.js';
import { Position } from './factors/position.js';
import { Vector } from './vector.js';
import { TANK_CONSTANTS } from './constants.js';
import { Wall } from './wall-utils.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MAGIC = [0x41, 0x51]; // "AQ"
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 123;
const THUMBNAIL_MARGIN = 8;
const ORGANISM_SCALE = 2.5;
const FISH_SPRITE_HEIGHT = 41;   // matches MAX_SPRITE_HEIGHT in embertetra.ts
const SNAIL_SPRITE_HEIGHT = 32;  // matches SNAIL_SPRITE_HEIGHT in snail.ts

const WALLS: Wall[] = ['front', 'back', 'left', 'right', 'bottom'];
const LIFE_STATES: SnailLifeState[] = ['normal', 'egg-laying', 'dying', 'shell', 'dead'];

// ── Module state ───────────────────────────────────────────────────────────

let modalOpen = false;

export function isModalOpen(): boolean {
    return modalOpen;
}

// ── Rounding helper ────────────────────────────────────────────────────────

function r1(n: number): number {
    return Math.round(n * 10) / 10;
}

// ── Serialization ──────────────────────────────────────────────────────────

export function serializeTank(tank: Tank): object {
    // Fish (EmberTetra only, not snails)
    const fishData = tank.fish
        .filter(f => f instanceof EmberTetra)
        .map(f => {
            const fish = f as Fish;
            return {
                p: [r1(f.position.x), r1(f.position.y), r1(f.position.z)],
                v: [r1(f.position.delta.x), r1(f.position.delta.y), r1(f.position.delta.z)],
                s: r1(f.size),
                h: r1(fish.getHungerValue()),
                i: r1(fish.getInitiativeValue()),
                e: r1(fish.getFearValue())
            };
        });

    // Snails
    const snailData = tank.getSnails().map(snail => {
        return {
            p: [r1(snail.position.x), r1(snail.position.y), r1(snail.position.z)],
            v: [r1(snail.position.delta.x), r1(snail.position.delta.y), r1(snail.position.delta.z)],
            s: r1(snail.size),
            w: WALLS.indexOf(snail.getWall()),
            h: r1(snail.getHungerValue()),
            l: LIFE_STATES.indexOf(snail.getLifeState()),
            lc: snail.getLifeStateCounter(),
            ec: r1(snail.getEatingCounter()),
            o: Math.round(snail.getOpacity()),
            ss: snail.getShellSettled(),
            cg: snail.getCanSetGoals()
        };
    });

    // Microfauna
    const microData = tank.microfauna.map(m => ({
        p: [r1(m.position.x), r1(m.position.y), r1(m.position.z)],
        v: [r1(m.position.delta.x), r1(m.position.delta.y), r1(m.position.delta.z)],
        s: r1(m.size)
    }));

    // Food
    const foodData = tank.food.map(f => ({
        p: [r1(f.position.x), r1(f.position.y), r1(f.position.z)],
        w: f.inWater ? 1 : 0,
        f: f.floating ? 1 : 0,
        t: f.settled ? 1 : 0
    }));

    // Egg clumps
    const eggData = tank.eggClumps.map(e => ({
        p: [r1(e.position.x), r1(e.position.y), r1(e.position.z)],
        w: WALLS.indexOf(e.getWall()),
        t: e.getHatchTimer()
    }));

    // Algae - store as [encodedPosition, level] pairs
    const algaeData: [number, number][] = [];
    const algaeGrids = tank.algae.getWallGrids();
    const activeCells = tank.algae.getActiveCells();
    for (const encoded of activeCells) {
        // Decode to get wall/x/y, look up level
        const wallIndex = Math.floor(encoded / 1000000);
        const remainder = encoded % 1000000;
        const x = Math.floor(remainder / 1000);
        const y = remainder % 1000;
        const wallNames = ['front', 'back', 'left', 'right'] as const;
        if (wallIndex >= 0 && wallIndex < wallNames.length) {
            const wall = wallNames[wallIndex];
            const level = algaeGrids[wall][x]?.[y];
            if (level && level > 0) {
                algaeData.push([encoded, level]);
            }
        }
    }

    return {
        f: fishData,
        n: snailData,
        m: microData,
        d: foodData,
        g: eggData,
        a: algaeData
    };
}

export function deserializeTank(data: any, tank: Tank): void {
    // Clear existing state
    tank.fish.length = 0;
    tank.microfauna.length = 0;
    tank.food.length = 0;
    tank.eggClumps.length = 0;

    // Restore fish (EmberTetra)
    if (data.f) {
        for (const fd of data.f) {
            const fish = new EmberTetra(fd.p[0], fd.p[1], fd.p[2], fd.s);
            const vel = new Vector(fd.v[0], fd.v[1], fd.v[2]);
            // Ensure non-zero velocity to avoid division-by-zero in field-of-view checks
            fish.position.delta = vel.magnitude() > 0.001 ? vel : Vector.random(-0.1, 0.1);
            fish.setHungerValue(fd.h);
            fish.setInitiativeValue(fd.i);
            fish.setFearValue(fd.e);
            tank.addFish(fish);
        }
    }

    // Restore snails
    if (data.n) {
        for (const sd of data.n) {
            const wall = WALLS[sd.w] || 'back';
            const pos = new Vector(sd.p[0], sd.p[1], sd.p[2]);
            const snail = new Snail(sd.s, pos, wall, sd.h);
            snail.setTank(tank);
            snail.loadSaveState({
                lifeState: LIFE_STATES[sd.l] || 'normal',
                lifeStateCounter: sd.lc || 0,
                eatingCounter: sd.ec || 0,
                opacity: sd.o !== undefined ? sd.o : 255,
                shellSettled: sd.ss || false,
                canSetGoals: sd.cg !== undefined ? sd.cg : true,
                velocity: new Vector(sd.v[0], sd.v[1], sd.v[2])
            });
            tank.addFish(snail);
        }
    }

    // Restore microfauna
    if (data.m) {
        for (const md of data.m) {
            const pos = new Position(
                new Vector(md.p[0], md.p[1], md.p[2]),
                new Vector(md.v[0], md.v[1], md.v[2])
            );
            const micro = new Microfauna(pos);
            micro.size = md.s;
            micro.setTank(tank);
            tank.addMicrofauna(micro);
        }
    }

    // Restore food
    if (data.d) {
        for (const fd of data.d) {
            const food = new Food(fd.p[0], fd.p[1], fd.p[2]);
            food.inWater = fd.w === 1;
            food.floating = fd.f === 1;
            food.settled = fd.t === 1;
            if (food.inWater) {
                food.position.setShouldConstrain(true);
            }
            tank.addFood(food);
        }
    }

    // Restore egg clumps
    if (data.g) {
        for (const ed of data.g) {
            const wall = WALLS[ed.w] || 'front';
            const eggClump = new EggClump(
                new Vector(ed.p[0], ed.p[1], ed.p[2]),
                wall
            );
            eggClump.setHatchTimer(ed.t);
            tank.addEggClump(eggClump);
        }
    }

    // Restore algae
    if (data.a) {
        tank.algae.loadSaveState(data.a);
    }
}

// ── Compression (deflate-raw via CompressionStream API) ────────────────────

async function compress(data: Uint8Array): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();

    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

// ── LSB Steganography ──────────────────────────────────────────────────────

/**
 * Encode data into the 2 least significant bits of each RGB channel.
 * Alpha channel is untouched. Each pixel stores 6 bits of data.
 */
function encodeLSB(imageData: ImageData, data: Uint8Array): void {
    const pixels = imageData.data;
    // Build header: magic (2 bytes) + length (4 bytes, little-endian) + data
    const header = new Uint8Array(6);
    header[0] = MAGIC[0];
    header[1] = MAGIC[1];
    header[2] = data.length & 0xFF;
    header[3] = (data.length >> 8) & 0xFF;
    header[4] = (data.length >> 16) & 0xFF;
    header[5] = (data.length >> 24) & 0xFF;

    const fullData = new Uint8Array(header.length + data.length);
    fullData.set(header);
    fullData.set(data, header.length);

    const totalBits = fullData.length * 8;
    const maxCapacity = (pixels.length / 4) * 6; // 6 bits per pixel
    if (totalBits > maxCapacity) {
        throw new Error(`Data too large: ${fullData.length} bytes requires ${totalBits} bits, but image only has capacity for ${Math.floor(maxCapacity / 8)} bytes`);
    }

    let bitIndex = 0;
    for (let pixelOffset = 0; pixelOffset < pixels.length && bitIndex < totalBits; pixelOffset += 4) {
        for (let c = 0; c < 3 && bitIndex < totalBits; c++) {
            const channelIdx = pixelOffset + c;
            const byteIdx = Math.floor(bitIndex / 8);
            const bitOffset = bitIndex % 8;
            // Extract 2 bits from the data byte at the current position
            const bits = (fullData[byteIdx] >> (6 - bitOffset)) & 0x03;
            // Clear bottom 2 bits and set new ones
            pixels[channelIdx] = (pixels[channelIdx] & 0xFC) | bits;
            bitIndex += 2;
        }
    }
}

/**
 * Decode data from the 2 least significant bits of each RGB channel.
 * Returns null if magic number doesn't match.
 */
function decodeLSB(imageData: ImageData): Uint8Array | null {
    const pixels = imageData.data;

    // First, decode the header (6 bytes = 48 bits = 8 pixels)
    const header = decodeBytesFromPixels(pixels, 0, 6);

    // Check magic
    if (header[0] !== MAGIC[0] || header[1] !== MAGIC[1]) {
        return null;
    }

    // Read length (little-endian uint32)
    const dataLength = header[2] | (header[3] << 8) | (header[4] << 16) | (header[5] << 24);

    if (dataLength <= 0 || dataLength > 100000) {
        return null; // Sanity check
    }

    // Decode the full payload (header + data)
    const totalBytes = 6 + dataLength;
    const fullData = decodeBytesFromPixels(pixels, 0, totalBytes);
    return fullData.slice(6);
}

function decodeBytesFromPixels(pixels: Uint8ClampedArray, startBit: number, numBytes: number): Uint8Array {
    const result = new Uint8Array(numBytes);
    let bitIndex = startBit;
    const totalBits = startBit + numBytes * 8;

    for (let pixelOffset = 0; pixelOffset < pixels.length && bitIndex < totalBits; pixelOffset += 4) {
        for (let c = 0; c < 3 && bitIndex < totalBits; c++) {
            const bits = pixels[pixelOffset + c] & 0x03;
            const byteIdx = Math.floor(bitIndex / 8);
            const bitOffset = bitIndex % 8;
            result[byteIdx] |= (bits << (6 - bitOffset));
            bitIndex += 2;
        }
    }

    return result;
}

// ── Thumbnail renderer ─────────────────────────────────────────────────────

function renderThumbnail(tank: Tank): ImageData {
    const offscreen = document.createElement('canvas');
    offscreen.width = THUMBNAIL_WIDTH;
    offscreen.height = THUMBNAIL_HEIGHT;
    const ctx = offscreen.getContext('2d')!;

    const m = THUMBNAIL_MARGIN;
    const tankW = THUMBNAIL_WIDTH - 2 * m;
    const tankH = THUMBNAIL_HEIGHT - 2 * m;

    // Coordinate mapping: main-canvas tank coords → thumbnail inset area
    const scaleX = tankW / TANK_CONSTANTS.WIDTH;
    const scaleY = tankH / TANK_CONSTANTS.HEIGHT;

    // Helper: map a main-canvas coordinate to thumbnail coordinate
    const tx = (x: number) => m + (x - TANK_CONSTANTS.X) * scaleX;
    const ty = (y: number) => m + (y - TANK_CONSTANTS.Y) * scaleY;

    // Back face coordinates (same math as Tank constructor)
    const bs = TANK_CONSTANTS.BACK_SCALE;
    const backX = TANK_CONSTANTS.X + (TANK_CONSTANTS.WIDTH - TANK_CONSTANTS.WIDTH * bs) / 2;
    const backY = TANK_CONSTANTS.Y + (TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.HEIGHT * bs) / 2;
    const backW = TANK_CONSTANTS.WIDTH * bs;
    const backH = TANK_CONSTANTS.HEIGHT * bs;

    // 1. Background fill (area outside the tank)
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    // 2. Tank water fill
    ctx.fillStyle = 'rgba(173, 216, 230, 0.35)';
    ctx.fillRect(m, m, tankW, tankH);

    // 3. Back face edges
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(tx(backX), ty(backY), backW * scaleX, backH * scaleY);

    // 4. Connecting edges (front corners to back corners)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 0.6;
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };
    // top-left
    drawLine(m, m, tx(backX), ty(backY));
    // top-right
    drawLine(m + tankW, m, tx(backX) + backW * scaleX, ty(backY));
    // bottom-left
    drawLine(m, m + tankH, tx(backX), ty(backY) + backH * scaleY);
    // bottom-right
    drawLine(m + tankW, m + tankH, tx(backX) + backW * scaleX, ty(backY) + backH * scaleY);

    // 5. Gravel strip at the bottom
    const gravelH = 4;
    ctx.fillStyle = '#a0896c';
    ctx.fillRect(m, m + tankH - gravelH, tankW, gravelH);

    // 6. Draw fish sprites (EmberTetra only)
    const fishSpriteSource = EmberTetra.spritesheet
        ? (EmberTetra.spritesheet as any).canvas || EmberTetra.spritesheet
        : null;
    if (fishSpriteSource) {
        for (const f of tank.fish) {
            if (!(f instanceof EmberTetra)) continue;

            const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(f.position.value);
            const thumbX = m + (renderX - TANK_CONSTANTS.X) * scaleX;
            const thumbY = m + (renderY - TANK_CONSTANTS.Y) * scaleY;

            const { index, mirrored } = f.getSpriteInfo();
            const spriteConfig = EmberTetra.SPRITE_CONFIGS[index];

            // Size matches main render logic but inflated by ORGANISM_SCALE
            const sizeScale = (f.size * depthScale) / FISH_SPRITE_HEIGHT;
            const scaledW = spriteConfig.width * sizeScale * scaleX * ORGANISM_SCALE;
            const scaledH = spriteConfig.height * sizeScale * scaleY * ORGANISM_SCALE;

            ctx.save();
            ctx.translate(thumbX, thumbY);
            if (mirrored) ctx.scale(-1, 1);
            ctx.drawImage(
                fishSpriteSource,
                spriteConfig.x, spriteConfig.y,
                spriteConfig.width, spriteConfig.height,
                -scaledW / 2, -scaledH / 2,
                scaledW, scaledH
            );
            ctx.restore();
        }
    }

    // 7. Draw snail sprites with proper sprite selection
    const snailSpriteSource = Snail.spritesheet
        ? (Snail.spritesheet as any).canvas || Snail.spritesheet
        : null;
    if (snailSpriteSource) {
        for (const snail of tank.getSnails()) {
            if (snail.getLifeState() === 'dead') continue;

            const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(snail.position.value);
            const thumbX = m + (renderX - TANK_CONSTANTS.X) * scaleX;
            const thumbY = m + (renderY - TANK_CONSTANTS.Y) * scaleY;

            const isShell = snail.getLifeState() === 'shell';
            const { index, rotation, mirrored } = snail.getSpriteInfo();
            const finalIndex = isShell ? 6 : index;
            const config = Snail.SPRITE_CONFIGS[finalIndex];
            const finalRotation = isShell ? 0 : rotation;
            const finalMirrored = isShell ? false : mirrored;

            const sizeScale = (snail.size * depthScale) / SNAIL_SPRITE_HEIGHT;
            const scaledW = config.width * sizeScale * scaleX * ORGANISM_SCALE;
            const scaledH = config.height * sizeScale * scaleY * ORGANISM_SCALE;

            ctx.save();
            ctx.translate(thumbX, thumbY);
            if (finalRotation !== 0) ctx.rotate(finalRotation);
            if (finalMirrored) ctx.scale(-1, 1);
            ctx.drawImage(
                snailSpriteSource,
                config.x, config.y,
                config.width, config.height,
                -scaledW / 2, -scaledH / 2,
                scaledW, scaledH
            );
            ctx.restore();
        }
    }

    // 8. Water line (front)
    const waterLineY = m + (TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT) * scaleY;
    ctx.strokeStyle = 'rgba(100, 160, 200, 0.5)';
    ctx.lineWidth = 0.5;
    drawLine(m, waterLineY, m + tankW, waterLineY);

    // 9. Back water line
    const backWaterY = ty(backY + backH * TANK_CONSTANTS.WATER_LEVEL_PERCENT);
    drawLine(tx(backX), backWaterY, tx(backX) + backW * scaleX, backWaterY);
    // Connecting water lines
    drawLine(m, waterLineY, tx(backX), backWaterY);
    drawLine(m + tankW, waterLineY, tx(backX) + backW * scaleX, backWaterY);

    // 10. Front tank border (drawn last so it's on top)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m, m, tankW, tankH);

    return ctx.getImageData(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// ── Modal UI ───────────────────────────────────────────────────────────────

function createBackdrop(): HTMLDivElement {
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 10000; font-family: system-ui, -apple-system, sans-serif;
    `;
    return backdrop;
}

function createModalBox(): HTMLDivElement {
    const box = document.createElement('div');
    box.style.cssText = `
        background: #f0f4f8; border-radius: 12px; padding: 24px;
        max-width: 420px; width: 90%; text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 1px solid #d0dce8;
    `;
    return box;
}

function createButton(text: string, primary: boolean = false): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
        padding: 8px 20px; border-radius: 6px; border: 1px solid ${primary ? '#3070c0' : '#b0bec5'};
        background: ${primary ? '#4090d0' : '#ffffff'}; color: ${primary ? '#ffffff' : '#333333'};
        font-size: 14px; cursor: pointer; margin: 0 6px; font-family: inherit;
        transition: background 0.15s;
    `;
    btn.addEventListener('mouseenter', () => {
        btn.style.background = primary ? '#3070c0' : '#e8ecf0';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = primary ? '#4090d0' : '#ffffff';
    });
    return btn;
}

function closeModal(backdrop: HTMLDivElement): void {
    backdrop.remove();
    modalOpen = false;
}

// ── Save flow ──────────────────────────────────────────────────────────────

export async function handleSave(tank: Tank): Promise<void> {
    if (modalOpen) return;
    modalOpen = true;

    try {
        // 1. Serialize state
        const state = serializeTank(tank);
        const json = JSON.stringify(state);
        const jsonBytes = new TextEncoder().encode(json);

        // 2. Compress
        const compressed = await compress(jsonBytes);

        // 3. Render thumbnail and encode data
        const imageData = renderThumbnail(tank);
        encodeLSB(imageData, compressed);
        const encodedCanvas = imageDataToCanvas(imageData);

        // 4. Convert to blob
        const blob = await new Promise<Blob>((resolve) => {
            encodedCanvas.toBlob((b) => resolve(b!), 'image/png');
        });
        const dataUrl = URL.createObjectURL(blob);

        // 5. Show modal
        showSaveModal(dataUrl, blob, json.length, compressed.length);

    } catch (err) {
        console.error('Save failed:', err);
        modalOpen = false;
        alert('Save failed: ' + (err as Error).message);
    }
}

function showSaveModal(dataUrl: string, blob: Blob, jsonSize: number, compressedSize: number): void {
    const backdrop = createBackdrop();
    const box = createModalBox();

    const title = document.createElement('h3');
    title.textContent = 'Save Aquarium';
    title.style.cssText = 'margin: 0 0 12px 0; color: #2c3e50; font-size: 18px;';
    box.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Your aquarium state is hidden inside this image.';
    subtitle.style.cssText = 'margin: 0 0 12px 0; color: #7f8c8d; font-size: 13px;';
    box.appendChild(subtitle);

    // Image preview (displayed at 2x size for visibility)
    const img = document.createElement('img');
    img.src = dataUrl;
    img.style.cssText = `
        width: ${THUMBNAIL_WIDTH * 2}px; height: ${THUMBNAIL_HEIGHT * 2}px;
        image-rendering: pixelated; border: 2px solid #b0c4de;
        border-radius: 6px; margin: 8px 0; display: block; margin-left: auto; margin-right: auto;
    `;
    box.appendChild(img);

    const info = document.createElement('p');
    info.textContent = `${compressedSize} bytes encoded (${jsonSize} bytes uncompressed)`;
    info.style.cssText = 'margin: 4px 0 16px 0; color: #95a5a6; font-size: 11px;';
    box.appendChild(info);

    const warning = document.createElement('p');
    warning.textContent = 'Share as PNG only — JPEG or chat app compression will corrupt the data.';
    warning.style.cssText = 'margin: 0 0 16px 0; color: #c0392b; font-size: 11px; font-style: italic;';
    box.appendChild(warning);

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; justify-content: center; gap: 8px;';

    const downloadBtn = createButton('Download', true);
    downloadBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        a.download = `aquarium-${dateStr}-${timeStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    const copyBtn = createButton('Copy Image');
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy Image'; }, 2000);
        } catch {
            copyBtn.textContent = 'Copy failed';
            setTimeout(() => { copyBtn.textContent = 'Copy Image'; }, 2000);
        }
    });

    const closeBtn = createButton('Close');
    closeBtn.addEventListener('click', () => {
        URL.revokeObjectURL(dataUrl);
        closeModal(backdrop);
    });

    buttonRow.appendChild(downloadBtn);
    buttonRow.appendChild(copyBtn);
    buttonRow.appendChild(closeBtn);
    box.appendChild(buttonRow);

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            URL.revokeObjectURL(dataUrl);
            closeModal(backdrop);
        }
    });
}

// ── Load flow ──────────────────────────────────────────────────────────────

export async function handleLoad(tank: Tank): Promise<void> {
    if (modalOpen) return;
    modalOpen = true;

    showLoadModal(tank);
}

function showLoadModal(tank: Tank): void {
    const backdrop = createBackdrop();
    const box = createModalBox();

    const title = document.createElement('h3');
    title.textContent = 'Load Aquarium';
    title.style.cssText = 'margin: 0 0 12px 0; color: #2c3e50; font-size: 18px;';
    box.appendChild(title);

    // Drop zone
    const dropZone = document.createElement('div');
    dropZone.style.cssText = `
        border: 2px dashed #b0c4de; border-radius: 8px; padding: 30px 20px;
        margin: 12px 0; cursor: pointer; color: #7f8c8d; font-size: 14px;
        transition: border-color 0.2s, background 0.2s;
    `;
    dropZone.textContent = 'Drop a save image here, or click to select';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/*';
    fileInput.style.display = 'none';

    // Preview image
    const preview = document.createElement('img');
    preview.style.cssText = `
        display: none; max-width: ${THUMBNAIL_WIDTH * 2}px; width: 100%; height: auto;
        image-rendering: pixelated; border: 2px solid #b0c4de;
        border-radius: 6px; margin: 8px auto;
    `;

    // Error message
    const errorMsg = document.createElement('p');
    errorMsg.style.cssText = 'color: #c0392b; font-size: 13px; margin: 8px 0; display: none;';

    // Status message
    const statusMsg = document.createElement('p');
    statusMsg.style.cssText = 'color: #27ae60; font-size: 13px; margin: 8px 0; display: none;';

    let loadedData: any = null;

    const loadBtn = createButton('Load', true);
    loadBtn.style.opacity = '0.5';
    loadBtn.style.pointerEvents = 'none';

    async function processFile(file: File): Promise<void> {
        errorMsg.style.display = 'none';
        statusMsg.style.display = 'none';
        loadedData = null;
        loadBtn.style.opacity = '0.5';
        loadBtn.style.pointerEvents = 'none';

        try {
            // Load the image
            const imgUrl = URL.createObjectURL(file);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = imgUrl;
            });

            // Show preview
            preview.src = imgUrl;
            preview.style.display = 'block';
            dropZone.style.display = 'none';

            // Read pixel data
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            // Decode LSB data
            const rawData = decodeLSB(imageData);
            if (!rawData) {
                throw new Error('No save data found in this image. Make sure it\'s an unmodified PNG save file.');
            }

            // Decompress
            const decompressed = await decompress(rawData);
            const json = new TextDecoder().decode(decompressed);
            loadedData = JSON.parse(json);

            // Count entities
            const fishCount = loadedData.f?.length || 0;
            const snailCount = loadedData.n?.length || 0;
            const microCount = loadedData.m?.length || 0;
            const foodCount = loadedData.d?.length || 0;
            const eggCount = loadedData.g?.length || 0;
            const algaeCount = loadedData.a?.length || 0;

            statusMsg.textContent = `Found: ${fishCount} fish, ${snailCount} snails, ${microCount} microfauna, ${foodCount} food, ${eggCount} eggs, ${algaeCount} algae cells`;
            statusMsg.style.display = 'block';

            loadBtn.style.opacity = '1';
            loadBtn.style.pointerEvents = 'auto';

        } catch (err) {
            errorMsg.textContent = (err as Error).message;
            errorMsg.style.display = 'block';
            preview.style.display = 'none';
            dropZone.style.display = 'block';
        }
    }

    // File input handling
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
            processFile(fileInput.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#4090d0';
        dropZone.style.background = '#e8f0f8';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#b0c4de';
        dropZone.style.background = 'transparent';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#b0c4de';
        dropZone.style.background = 'transparent';
        if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    });

    // Click preview to re-select
    preview.addEventListener('click', () => {
        preview.style.display = 'none';
        dropZone.style.display = 'block';
        statusMsg.style.display = 'none';
        errorMsg.style.display = 'none';
        loadedData = null;
        loadBtn.style.opacity = '0.5';
        loadBtn.style.pointerEvents = 'none';
        fileInput.click();
    });

    // Button row
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; justify-content: center; gap: 8px; margin-top: 16px;';

    loadBtn.addEventListener('click', () => {
        if (!loadedData) return;
        try {
            deserializeTank(loadedData, tank);
            closeModal(backdrop);
        } catch (err) {
            errorMsg.textContent = 'Failed to load state: ' + (err as Error).message;
            errorMsg.style.display = 'block';
        }
    });

    const cancelBtn = createButton('Cancel');
    cancelBtn.addEventListener('click', () => closeModal(backdrop));

    buttonRow.appendChild(loadBtn);
    buttonRow.appendChild(cancelBtn);

    box.appendChild(dropZone);
    box.appendChild(fileInput);
    box.appendChild(preview);
    box.appendChild(errorMsg);
    box.appendChild(statusMsg);
    box.appendChild(buttonRow);

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeModal(backdrop);
        }
    });
}
