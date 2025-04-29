// context/LeftSidebarContext.tsx
import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';

interface LeftSidebarContextType {
  isLeftCollapsed: boolean;
  toggleLeftCollapse: () => void;
}

const LeftSidebarContext = createContext<LeftSidebarContextType | undefined>(undefined);

export const useLeftSidebarContext = () => {
  const context = useContext(LeftSidebarContext);
  if (context === undefined) {
    throw new Error('useLeftSidebarContext must be used within a LeftSidebarProvider');
  }
  return context;
};

export const LeftSidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false); // Começa EXPANDIDA

  const toggleLeftCollapse = () => {
    setIsLeftCollapsed(prev => !prev);
  };

  const value = useMemo(() => ({
    isLeftCollapsed,
    toggleLeftCollapse,
  }), [isLeftCollapsed]);

  return (
    <LeftSidebarContext.Provider value={value}>
      {children}
    </LeftSidebarContext.Provider>
  );
};
