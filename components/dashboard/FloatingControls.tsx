import React from 'react';
import { Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingControlsProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const FloatingControls: React.FC<FloatingControlsProps> = ({ activeView, onViewChange }) => {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className={`h-8 text-xs border-[#2d62a3]/30 hover:bg-[#2d62a3]/10 floating-button text-white ${
          activeView === 'grid' ? 'bg-[#000000]/30' : ''
        }`}
        onClick={() => onViewChange('grid')}
      >
        <Grid className="h-3.5 w-3.5 mr-1" />
        Grid
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`h-8 text-xs border-[#000000]/30 hover:bg-[#000000]/10 floating-button text-white ${
          activeView === 'list' ? 'bg-[#2d62a3]/30' : ''
        }`}
        onClick={() => onViewChange('list')}
      >
        <List className="h-3.5 w-3.5 mr-1" />
        List
      </Button>
    </div>
  );
};

export default FloatingControls;