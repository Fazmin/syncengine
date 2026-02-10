'use client';

import { useCallback, useEffect, useState } from 'react';

export type FontSize = 'compact' | 'default' | 'large';

const STORAGE_KEY = 'syncengine-font-size';

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSize>('default');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as FontSize | null;
    const size = stored && ['compact', 'default', 'large'].includes(stored) ? stored : 'default';
    setFontSizeState(size);
    document.documentElement.setAttribute('data-font-size', size);
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(STORAGE_KEY, size);
    document.documentElement.setAttribute('data-font-size', size);
  }, []);

  return { fontSize, setFontSize };
}
