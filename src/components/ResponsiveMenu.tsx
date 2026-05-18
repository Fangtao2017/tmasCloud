import React, { useState, useRef, useLayoutEffect } from 'react';
import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';

export interface MenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  path?: string;
}

interface ResponsiveMenuProps {
  items: MenuItem[];
  activeKey?: string;
  renderItem: (item: MenuItem, isActive: boolean) => React.ReactNode;
  moreLabel?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  itemStyle?: React.CSSProperties;
}

export const ResponsiveMenu: React.FC<ResponsiveMenuProps> = ({
  items,
  activeKey,
  renderItem,
  moreLabel = <span style={{ cursor: 'pointer', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>More <DownOutlined style={{ fontSize: 10 }} /></span>,
  style,
  className,
  itemStyle
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleItems, setVisibleItems] = useState<MenuItem[]>(items);
  const [overflowItems, setOverflowItems] = useState<MenuItem[]>([]);
  
  // We need to measure items. We render them invisibly.
  useLayoutEffect(() => {
    if (!measureRef.current || !containerRef.current) return;

    const calculate = () => {
      if (!measureRef.current || !containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const childNodes = measureRef.current.children;
      const widths: number[] = [];
      let moreBtnWidth = 0;

      // Measure items
      for (let i = 0; i < items.length; i++) {
        widths.push((childNodes[i] as HTMLElement).offsetWidth);
      }
      // Measure "More" button (last child)
      moreBtnWidth = (childNodes[items.length] as HTMLElement).offsetWidth;
      
      // Find active item index
      const activeIndex = items.findIndex(i => 
        Array.isArray(activeKey) ? activeKey.includes(i.key) : i.key === activeKey
      );

      const availableWidth = containerWidth - moreBtnWidth;
      
      const totalAllWidth = widths.reduce((a, b) => a + b, 0);
      
      if (totalAllWidth <= containerWidth) {
        setVisibleItems(items);
        setOverflowItems([]);
        return;
      }

      // We need overflow.
      let currentSum = 0;
      const fits: number[] = [];
      for (let i = 0; i < items.length; i++) {
        if (currentSum + widths[i] <= availableWidth) {
          currentSum += widths[i];
          fits.push(i);
        } else {
          break;
        }
      }
      
      // Check if active is in fits
      if (activeIndex !== -1 && !fits.includes(activeIndex)) {
        // Active item is not visible. We need to force it.
        // We need to remove items from `fits` until we have space for `widths[activeIndex]`.
        // We remove from the end of `fits`.
        
        const spaceNeeded = widths[activeIndex];
        // We already have `currentSum`. We need `currentSum + spaceNeeded <= availableWidth`.
        // So we need to reduce `currentSum` by removing items.
        
        while (fits.length > 0 && (currentSum + spaceNeeded > availableWidth)) {
          const removedIndex = fits.pop();
          if (removedIndex !== undefined) {
            currentSum -= widths[removedIndex];
          }
        }
        
        // Now add active index
        if (currentSum + spaceNeeded <= availableWidth) {
             fits.push(activeIndex);
             // Sort indices to maintain order?
             fits.sort((a, b) => a - b);
        } else {
            // Edge case: Active item itself is wider than available width (minus More button).
            // In this case, we probably just show Active + More (even if it overflows a bit) or just Active.
            // But we assumed availableWidth = container - moreBtn.
            fits.push(activeIndex);
        }
      }
      
      // Construct visible and overflow arrays
      const visible = fits.map(i => items[i]);
      const overflow = items.filter((_, i) => !fits.includes(i));
      
      setVisibleItems(visible);
      setOverflowItems(overflow);
    };

    calculate();

    const observer = new ResizeObserver(calculate);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [items, activeKey]);

  const overflowMenu: MenuProps['items'] = overflowItems.map(item => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    onClick: item.onClick,
  }));

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ 
        ...style, 
        display: 'flex', 
        flexWrap: 'nowrap', 
        overflow: 'hidden', 
        width: '100%',
        position: 'relative'
      }}
    >
      {/* Visible Items */}
      {visibleItems.map(item => (
        <div key={item.key} style={{ flexShrink: 0 }}>
          {renderItem(item, Array.isArray(activeKey) ? activeKey.includes(item.key) : item.key === activeKey)}
        </div>
      ))}

      {/* More Button */}
      {overflowItems.length > 0 && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Dropdown menu={{ items: overflowMenu }} trigger={['click', 'hover']}>
             {moreLabel as React.ReactElement}
          </Dropdown>
        </div>
      )}

      {/* Hidden Measure Layer */}
      <div 
        ref={measureRef}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          visibility: 'hidden', 
          pointerEvents: 'none',
          display: 'flex',
          flexWrap: 'nowrap'
        }}
      >
        {items.map(item => (
          <div key={item.key} style={itemStyle}>
            {renderItem(item, false)}
          </div>
        ))}
        <div style={itemStyle}>
            {moreLabel}
        </div>
      </div>
    </div>
  );
};
