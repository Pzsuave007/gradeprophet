import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

export const ViewToggle = ({ view, onChange }) => (
  <div className="flex bg-[#111] border border-[#1a1a1a] rounded-lg p-0.5" data-testid="view-toggle">
    <button onClick={() => onChange('list')}
      className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white'}`}
      data-testid="view-list-btn">
      <List className="w-4 h-4" />
    </button>
    <button onClick={() => onChange('grid')}
      className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-[#3b82f6] text-white' : 'text-gray-500 hover:text-white'}`}
      data-testid="view-grid-btn">
      <LayoutGrid className="w-4 h-4" />
    </button>
  </div>
);
