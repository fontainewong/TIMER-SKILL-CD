interface Bounds { left: number; top: number; width: number; bottom: number }

// Anchor to the lower four cards without changing grid layout or covering row one.
export function popupBounds(grid: Bounds, secondRowTop: number) {
  return { left: grid.left, top: secondRowTop, width: grid.width, height: Math.max(0, grid.bottom - secondRowTop) };
}
