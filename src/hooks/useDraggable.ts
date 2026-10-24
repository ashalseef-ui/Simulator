import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseDraggableOptions {
  initialX?: number;
  initialY?: number;
  disabled?: boolean;
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { initialX = 0, initialY = 0, disabled = false } = options;
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      // Do not trigger drag if clicking interactive child elements
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('a')
      ) {
        return;
      }

      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [disabled, position.x, position.y]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const resetPosition = useCallback(() => {
    setPosition({ x: initialX, y: initialY });
  }, [initialX, initialY]);

  return {
    position,
    handleMouseDown,
    resetPosition,
    isDragging,
  };
}
