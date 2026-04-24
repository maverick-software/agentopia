import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CountryCodeOption } from './types';

const countryCodes: CountryCodeOption[] = [
  { value: '+1', label: 'US +1', country: 'US' },
  { value: '+1-ca', label: 'CA +1', country: 'CA' },
  { value: '+52', label: 'MX +52', country: 'MX' },
];

function CountryFlag({ country }: { country: CountryCodeOption['country'] }) {
  if (country === 'US') {
    return (
      <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480">
        <path fill="#bd3d44" d="M0 0h640v480H0" />
        <path stroke="#fff" strokeWidth="37" d="M0 55.3h640M0 129h640M0 203h640M0 277h640M0 351h640M0 425h640" />
        <path fill="#192f5d" d="M0 0h364.8v258.5H0" />
      </svg>
    );
  }

  if (country === 'CA') {
    return (
      <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480">
        <path fill="#d52b1e" d="M0 0h150v480H0zm490 0h150v480H490z" />
        <path fill="#fff" d="M150 0h340v480H150z" />
        <path fill="#d52b1e" d="M318 349.5l-41.5-30.8-41.7 30.6 15.7-49.7-41.6-30.8h51.4l15.8-49.7 16 49.7h51.3l-41.4 30.8" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-4 rounded-sm" viewBox="0 0 640 480">
      <path fill="#006847" d="M0 0h213.3v480H0z" />
      <path fill="#fff" d="M213.3 0h213.4v480H213.3z" />
      <path fill="#ce1126" d="M426.7 0H640v480H426.7z" />
      <circle cx="320" cy="240" r="60" fill="#fcdd09" />
    </svg>
  );
}

interface CountryCodeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function CountryCodeSelect({ value, onValueChange }: CountryCodeSelectProps) {
  const selected = countryCodes.find((country) => country.value === value) || countryCodes[0];

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[120px] rounded-lg">
        <SelectValue>
          <span className="flex items-center gap-2">
            <CountryFlag country={selected.country} />
            <span>{selected.label.split(' ')[1]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-lg">
        {countryCodes.map((country) => (
          <SelectItem key={country.value} value={country.value} className="rounded-md">
            <div className="flex items-center gap-2">
              <CountryFlag country={country.country} />
              <span className="font-medium">{country.label.split(' ')[0]}</span>
              <span className="text-muted-foreground">{country.label.split(' ')[1]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
