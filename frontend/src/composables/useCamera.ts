import { reactive } from "vue";

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export function useCamera() {
  const camera = reactive<Camera>({
    x: 0,
    y: 0,
    zoom: 1
  });

  function screenToWorld(px: number, py: number) {
    return { x: (px - camera.x) / camera.zoom, y: (py - camera.y) / camera.zoom };
  }

  function worldToScreen(wx: number, wy: number) {
    return { x: wx * camera.zoom + camera.x, y: wy * camera.zoom + camera.y };
  }

  function pan(dx: number, dy: number) {
    camera.x += dx;
    camera.y += dy;
  }

  function zoomAt(factor: number, anchorX: number, anchorY: number) {
    const before = screenToWorld(anchorX, anchorY);
    camera.zoom = Math.max(0.5, Math.min(3, camera.zoom * factor));
    const after = screenToWorld(anchorX, anchorY);
    camera.x += (after.x - before.x) * camera.zoom;
    camera.y += (after.y - before.y) * camera.zoom;
  }

  return { camera, screenToWorld, worldToScreen, pan, zoomAt };
}

