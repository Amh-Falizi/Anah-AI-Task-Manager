import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
}

export default function SearchableSelect({
  options, value, onChange, placeholder = "Select...", disabled = false, placement = 'bottom'
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => {
    const labelMatch = o.label ? o.label.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const subLabelMatch = o.subLabel ? o.subLabel.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    return labelMatch || subLabelMatch;
  });

  const selectedOption = options.find(o => o.id === value);

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <div 
        className={`flex items-center justify-between rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm focus-within:border-blue-500 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-strong' : 'text-subtle'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-muted" />
      </div>

      {isOpen && (
        <div className={`absolute z-10 w-full bg-surface border border-border-subtle rounded-md shadow-lg flex flex-col max-h-[300px] ${placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <div className="p-2 border-b border-border-subtle">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-muted" />
              <input
                type="text"
                autoFocus
                className="w-full bg-surface-dim border border-border-subtle rounded px-8 py-1.5 text-sm focus:outline-none focus:border-blue-500 placeholder-subtle text-strong"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.id}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface-dim transition-colors ${value === option.id ? 'bg-blue-500/10 text-blue-400' : 'text-muted hover:text-strong'}`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <div className="font-medium">{option.label}</div>
                  {option.subLabel && <div className="text-xs opacity-75">{option.subLabel}</div>}
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-subtle text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
