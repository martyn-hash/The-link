import { useSwipeable } from 'react-swipeable';
import { ReactNode } from 'react';

interface SwipeableTabsProps {
  children: ReactNode;
  tabs: string[];
  currentTab: string;
  onTabChange: (tab: string) => void;
  enabled?: boolean;
}

export function SwipeableTabsWrapper({ 
  children, 
  tabs, 
  currentTab, 
  onTabChange,
  enabled = true 
}: SwipeableTabsProps) {
  const currentIndex = tabs.indexOf(currentTab);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (!enabled) return;
      const nextIndex = currentIndex + 1;
      if (nextIndex < tabs.length) {
        onTabChange(tabs[nextIndex]);
      }
    },
    onSwipedRight: () => {
      if (!enabled) return;
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        onTabChange(tabs[prevIndex]);
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50, // Minimum swipe distance
    preventScrollOnSwipe: false,
    swipeDuration: 500,
  });

  return (
    <div {...handlers} className="w-full h-full">
      {children}
    </div>
  );
}
