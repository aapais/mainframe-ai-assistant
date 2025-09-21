import { useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps {
  isOpen: boolean;
  itemCount: number;
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  onSelect: () => void;
  onClose: () => void;
}

export function useKeyboardNavigation({
  isOpen,
  itemCount,
  selectedIndex,
  onIndexChange,
  onSelect,
  onClose
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        onIndexChange(selectedIndex < itemCount - 1 ? selectedIndex + 1 : 0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        onIndexChange(selectedIndex > 0 ? selectedIndex - 1 : itemCount - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          onSelect();
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, itemCount, selectedIndex, onIndexChange, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
