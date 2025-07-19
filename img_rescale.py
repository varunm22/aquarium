from PIL import Image
from collections import deque


def rescale_image(image_path, output_path, x, y):
    original_image = Image.open(image_path)
    resized_image = original_image.resize((x, y), Image.NEAREST)
    resized_image.save(output_path)


def make_bg_transparent(image_path, output_path, threshold=240):
    image = Image.open(image_path).convert("RGBA")
    # Convert background (near-white) pixels to transparent
    data = image.getdata()
    new_data = []

    for item in data:
        r, g, b, a = item
        if r > threshold and g > threshold and b > threshold:
            new_data.append((255, 255, 255, 0))  # fully transparent
        else:
            new_data.append((r, g, b, a))

    # Apply new data and save the image
    image.putdata(new_data)
    image.save(output_path, "PNG")


def make_bg_transparent_bfs(image_path, output_path, threshold):
    image = Image.open(image_path).convert("RGBA")
    width, height = image.size
    pixels = image.load()

    visited = [[False for _ in range(height)] for _ in range(width)]
    queue = deque()

    # Initialize queue with all outermost pixels
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    # 8 directions: up, down, left, right, and diagonals
    directions = [
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),  # N, S, W, E
        (-1, -1),
        (-1, 1),
        (1, -1),
        (1, 1),  # NW, NE, SW, SE
    ]

    # BFS flood-fill
    while queue:
        x, y = queue.popleft()

        if x < 0 or x >= width or y < 0 or y >= height:
            continue
        if visited[x][y]:
            continue

        r, g, b, a = pixels[x, y]
        if r > threshold and g > threshold and b > threshold:
            pixels[x, y] = (255, 255, 255, 0)  # Make transparent
            visited[x][y] = True
            # Add all 8 neighbors
            for dx, dy in directions:
                nx, ny = x + dx, y + dy
                queue.append((nx, ny))
        else:
            visited[x][y] = True  # Stop expanding into this pixel

    # Save the updated image
    image.save(output_path, "PNG")


# rescale_image("assets/snail.png", "assets/snail_small.png", 87 * 2, 60 * 2)
# rescale_image("assets/snail3.png", "assets/snail3_small.png", 64 * 2, 44 * 2)
make_bg_transparent_bfs("assets/snail.png", "assets/snail_clear.png", threshold=170)
