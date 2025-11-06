import { useSwipeable } from 'react-swipeable';
import { ReactNode, useEffect, useRef } from 'react';

interface SwipeableTabsProps {
  children: ReactNode;
  tabs: string[];
  currentTab: string;
  onTabChange: (tab: string) => void;
  enabled?: boolean;
  dataAttribute?: string;
}

export function SwipeableTabsWrapper({ 
  children, 
  tabs, 
  currentTab, 
  onTabChange,
  enabled = true,
  dataAttribute = 'main'
}: SwipeableTabsProps) {
  const currentIndex = tabs.indexOf(currentTab);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll active tab button into view when tab changes
  useEffect(() => {
    if (!enabled) return;
    
    // Find the tabs container using the data attribute
    const tabsContainer = document.querySelector(`[data-client-tabs="${dataAttribute}"]`);
    if (tabsContainer) {
      const activeTabButton = tabsContainer.querySelector(`[data-testid="tab-${currentTab}"]`);
      if (activeTabButton) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          activeTabButton.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        });
      }
    }
  }, [currentTab, enabled, dataAttribute]);

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
    <div ref={containerRef} {...handlers} className="w-full h-full">
      {children}
    </div>
  );
}
