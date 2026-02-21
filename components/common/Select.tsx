import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectProps {
    value: string | number;
    onChange: (value: string) => void;
    options: SelectOption[];
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    disabled = false,
    className = '',
    placeholder = 'Select...',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedOption = options.find((opt) => String(opt.value) === String(value));

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'
                    }`}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
            </button>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    <ul className="py-1">
                        {options.map((option) => (
                            <li
                                key={option.value}
                                onClick={() => {
                                    onChange(String(option.value));
                                    setIsOpen(false);
                                }}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary-900 ${String(option.value) === String(value) ? 'bg-primary-50 text-primary-900 font-medium' : 'text-gray-700'
                                    }`}
                            >
                                {option.label}
                            </li>
                        ))}
                        {options.length === 0 && (
                            <li className="px-3 py-2 text-sm text-gray-500 italic">No options available</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};
