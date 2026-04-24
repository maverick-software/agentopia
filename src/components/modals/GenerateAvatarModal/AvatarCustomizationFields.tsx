import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Brush, Building, User, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { AvatarOptions } from './types';
import { OptionButton } from './OptionButton';

interface AvatarCustomizationFieldsProps {
  options: AvatarOptions;
  generating: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  setOptions: React.Dispatch<React.SetStateAction<AvatarOptions>>;
}

export function AvatarCustomizationFields({
  options,
  generating,
  showAdvanced,
  onToggleAdvanced,
  setOptions,
}: AvatarCustomizationFieldsProps) {
  const disabled = generating;

  return (
    <>
      <Card className="bg-muted/30 border-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brush className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Art Style</Label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <OptionButton selected={options.style === 'photorealistic'} onClick={() => setOptions((p) => ({ ...p, style: 'photorealistic' }))} disabled={disabled}>Photorealistic</OptionButton>
            <OptionButton selected={options.style === 'cartoon'} onClick={() => setOptions((p) => ({ ...p, style: 'cartoon' }))} disabled={disabled}>Cartoon</OptionButton>
            <OptionButton selected={options.style === '3d_animation'} onClick={() => setOptions((p) => ({ ...p, style: '3d_animation' }))} disabled={disabled}>3D Animation</OptionButton>
            <OptionButton selected={options.style === 'other'} onClick={() => setOptions((p) => ({ ...p, style: 'other' }))} disabled={disabled}>Other</OptionButton>
          </div>
          {options.style === 'other' && (
            <Input
              placeholder="Describe art style..."
              value={options.customStyle}
              onChange={(e) => setOptions((p) => ({ ...p, customStyle: e.target.value }))}
              className="mt-2"
              disabled={disabled}
            />
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Theme</Label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <OptionButton selected={options.theme === 'office'} onClick={() => setOptions((p) => ({ ...p, theme: 'office' }))} disabled={disabled}>Office</OptionButton>
            <OptionButton selected={options.theme === 'android'} onClick={() => setOptions((p) => ({ ...p, theme: 'android' }))} disabled={disabled}>Android</OptionButton>
            <OptionButton selected={options.theme === 'alien'} onClick={() => setOptions((p) => ({ ...p, theme: 'alien' }))} disabled={disabled}>Alien</OptionButton>
            <OptionButton selected={options.theme === 'animal'} onClick={() => setOptions((p) => ({ ...p, theme: 'animal' }))} disabled={disabled}>Animal</OptionButton>
            <OptionButton selected={options.theme === 'fantasy'} onClick={() => setOptions((p) => ({ ...p, theme: 'fantasy' }))} disabled={disabled}>Fantasy</OptionButton>
            <OptionButton selected={options.theme === 'other'} onClick={() => setOptions((p) => ({ ...p, theme: 'other' }))} disabled={disabled}>Other</OptionButton>
          </div>
          {options.theme === 'other' && (
            <Input
              placeholder="Describe theme..."
              value={options.customTheme}
              onChange={(e) => setOptions((p) => ({ ...p, customTheme: e.target.value }))}
              className="mt-2"
              disabled={disabled}
            />
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Gender</Label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <OptionButton selected={options.gender === 'male'} onClick={() => setOptions((p) => ({ ...p, gender: 'male' }))} disabled={disabled}>Male</OptionButton>
            <OptionButton selected={options.gender === 'female'} onClick={() => setOptions((p) => ({ ...p, gender: 'female' }))} disabled={disabled}>Female</OptionButton>
            <OptionButton selected={options.gender === 'neutral'} onClick={() => setOptions((p) => ({ ...p, gender: 'neutral' }))} disabled={disabled}>Neutral</OptionButton>
            <OptionButton selected={options.gender === 'other'} onClick={() => setOptions((p) => ({ ...p, gender: 'other' }))} disabled={disabled}>Other</OptionButton>
          </div>
          {options.gender === 'other' && (
            <Input
              placeholder="Describe gender..."
              value={options.customGender}
              onChange={(e) => setOptions((p) => ({ ...p, customGender: e.target.value }))}
              className="mt-2"
              disabled={disabled}
            />
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30 border-0">
        <CardContent className="p-4">
          <button
            onClick={onToggleAdvanced}
            disabled={disabled}
            className="flex items-center justify-between w-full text-left hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium cursor-pointer">Advanced Options</Label>
            </div>
            {showAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Age</Label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <OptionButton selected={options.age === 'young_adult'} onClick={() => setOptions((p) => ({ ...p, age: 'young_adult' }))} disabled={disabled}>Young Adult</OptionButton>
                  <OptionButton selected={options.age === 'middle_aged'} onClick={() => setOptions((p) => ({ ...p, age: 'middle_aged' }))} disabled={disabled}>Middle-aged</OptionButton>
                  <OptionButton selected={options.age === 'elderly'} onClick={() => setOptions((p) => ({ ...p, age: 'elderly' }))} disabled={disabled}>Elderly</OptionButton>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Ethnicity</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  <OptionButton selected={options.ethnicity === 'caucasian'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'caucasian' }))} disabled={disabled}>Caucasian</OptionButton>
                  <OptionButton selected={options.ethnicity === 'african'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'african' }))} disabled={disabled}>African</OptionButton>
                  <OptionButton selected={options.ethnicity === 'asian'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'asian' }))} disabled={disabled}>Asian</OptionButton>
                  <OptionButton selected={options.ethnicity === 'hispanic'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'hispanic' }))} disabled={disabled}>Hispanic</OptionButton>
                  <OptionButton selected={options.ethnicity === 'middle_eastern'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'middle_eastern' }))} disabled={disabled}>Middle Eastern</OptionButton>
                  <OptionButton selected={options.ethnicity === 'mixed'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'mixed' }))} disabled={disabled}>Mixed</OptionButton>
                  <OptionButton selected={options.ethnicity === 'other'} onClick={() => setOptions((p) => ({ ...p, ethnicity: 'other' }))} disabled={disabled}>Other</OptionButton>
                </div>
                {options.ethnicity === 'other' && (
                  <Input
                    placeholder="Describe ethnicity..."
                    value={options.customEthnicity}
                    onChange={(e) => setOptions((p) => ({ ...p, customEthnicity: e.target.value }))}
                    className="mt-2"
                    disabled={disabled}
                  />
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Hair Color</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  <OptionButton selected={options.hair === 'blonde'} onClick={() => setOptions((p) => ({ ...p, hair: 'blonde' }))} disabled={disabled}>Blonde</OptionButton>
                  <OptionButton selected={options.hair === 'brown'} onClick={() => setOptions((p) => ({ ...p, hair: 'brown' }))} disabled={disabled}>Brown</OptionButton>
                  <OptionButton selected={options.hair === 'black'} onClick={() => setOptions((p) => ({ ...p, hair: 'black' }))} disabled={disabled}>Black</OptionButton>
                  <OptionButton selected={options.hair === 'red'} onClick={() => setOptions((p) => ({ ...p, hair: 'red' }))} disabled={disabled}>Red</OptionButton>
                  <OptionButton selected={options.hair === 'gray'} onClick={() => setOptions((p) => ({ ...p, hair: 'gray' }))} disabled={disabled}>Gray</OptionButton>
                  <OptionButton selected={options.hair === 'other'} onClick={() => setOptions((p) => ({ ...p, hair: 'other' }))} disabled={disabled}>Other</OptionButton>
                </div>
                {options.hair === 'other' && (
                  <Input
                    placeholder="Describe hair color..."
                    value={options.customHair}
                    onChange={(e) => setOptions((p) => ({ ...p, customHair: e.target.value }))}
                    className="mt-2"
                    disabled={disabled}
                  />
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Eye Color</Label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  <OptionButton selected={options.eyes === 'blue'} onClick={() => setOptions((p) => ({ ...p, eyes: 'blue' }))} disabled={disabled}>Blue</OptionButton>
                  <OptionButton selected={options.eyes === 'green'} onClick={() => setOptions((p) => ({ ...p, eyes: 'green' }))} disabled={disabled}>Green</OptionButton>
                  <OptionButton selected={options.eyes === 'brown'} onClick={() => setOptions((p) => ({ ...p, eyes: 'brown' }))} disabled={disabled}>Brown</OptionButton>
                  <OptionButton selected={options.eyes === 'hazel'} onClick={() => setOptions((p) => ({ ...p, eyes: 'hazel' }))} disabled={disabled}>Hazel</OptionButton>
                  <OptionButton selected={options.eyes === 'gray'} onClick={() => setOptions((p) => ({ ...p, eyes: 'gray' }))} disabled={disabled}>Gray</OptionButton>
                  <OptionButton selected={options.eyes === 'other'} onClick={() => setOptions((p) => ({ ...p, eyes: 'other' }))} disabled={disabled}>Other</OptionButton>
                </div>
                {options.eyes === 'other' && (
                  <Input
                    placeholder="Describe eye color..."
                    value={options.customEyes}
                    onChange={(e) => setOptions((p) => ({ ...p, customEyes: e.target.value }))}
                    className="mt-2"
                    disabled={disabled}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

