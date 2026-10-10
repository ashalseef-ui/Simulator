import { DeviceWindowState } from '../types/network';

export function tileWindows(
  windows: Record<string, DeviceWindowState>,
  screenWidth: number,
  screenHeight: number,
  mode: 'horizontal' | 'vertical' | 'grid' = 'grid'
): Record<string, DeviceWindowState> {
  const activeIds = Object.keys(windows).filter((id) => !windows[id].minimized);
  const count = activeIds.length;
  if (count === 0) return windows;

  const topOffset = 48; // TopBar offset
  const bottomOffset = 44; // Taskbar offset
  const usableWidth = Math.max(400, screenWidth - 280); // leave sidebar space if open
  const usableHeight = Math.max(300, screenHeight - topOffset - bottomOffset);

  const updated = { ...windows };

  if (mode === 'vertical' || count === 2) {
    const colWidth = Math.floor(usableWidth / count);
    activeIds.forEach((id, index) => {
      updated[id] = {
        ...updated[id],
        x: 280 + index * colWidth + 8,
        y: topOffset + 8,
        width: colWidth - 16,
        height: usableHeight - 16,
        maximized: false,
      };
    });
  } else if (mode === 'horizontal') {
    const rowHeight = Math.floor(usableHeight / count);
    activeIds.forEach((id, index) => {
      updated[id] = {
        ...updated[id],
        x: 280 + 8,
        y: topOffset + index * rowHeight + 8,
        width: usableWidth - 16,
        height: rowHeight - 16,
        maximized: false,
      };
    });
  } else {
    // Grid mode
    const cols = count <= 2 ? count : Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellWidth = Math.floor(usableWidth / cols);
    const cellHeight = Math.floor(usableHeight / rows);

    activeIds.forEach((id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      updated[id] = {
        ...updated[id],
        x: 280 + col * cellWidth + 8,
        y: topOffset + row * cellHeight + 8,
        width: cellWidth - 16,
        height: cellHeight - 16,
        maximized: false,
      };
    });
  }

  return updated;
}

export function cascadeWindows(
  windows: Record<string, DeviceWindowState>,
  _screenWidth: number,
  _screenHeight: number
): Record<string, DeviceWindowState> {
  const activeIds = Object.keys(windows).filter((id) => !windows[id].minimized);
  const updated = { ...windows };
  const baseOffset = 30;
  const startX = 300;
  const startY = 60;

  activeIds.forEach((id, index) => {
    updated[id] = {
      ...updated[id],
      x: startX + (index * baseOffset) % 250,
      y: startY + (index * baseOffset) % 200,
      width: 620,
      height: 480,
      maximized: false,
      zIndex: 10 + index,
    };
  });

  return updated;
}

export function clampWindowPosition(
  x: number,
  y: number,
  width: number,
  _height: number,
  maxWidth: number,
  maxHeight: number
): { x: number; y: number } {
  const minX = 0;
  const minY = 40;
  const maxX = Math.max(minX, maxWidth - Math.min(width, 200));
  const maxY = Math.max(minY, maxHeight - 60);

  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
}
