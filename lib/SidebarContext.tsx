// lib/SidebarContext.tsx
import { createContext, useContext } from 'react';

export const SidebarContext = createContext({ alreadyRendered: false });

export const useSidebarContext = () => useContext(SidebarContext);
