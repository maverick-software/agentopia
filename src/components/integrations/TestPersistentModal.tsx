import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Test component to isolate and debug the modal persistence issue
 */
export function TestPersistentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [inputValue, setInputValue] = useState('');
  const [renderCount, setRenderCount] = useState(0);
  
  useEffect(() => {
    setRenderCount(prev => prev + 1);
    console.log('[TestPersistentModal] Component rendered', {
      renderCount: renderCount + 1,
      isOpen,
      inputValue,
      timestamp: new Date().toISOString()
    });
  }, []);
  
  useEffect(() => {
    console.log('[TestPersistentModal] Props changed', {
      isOpen,
      inputValue,
      timestamp: new Date().toISOString()
    });
    
    return () => {
      console.log('[TestPersistentModal] Cleanup function called', {
        inputValue,
        timestamp: new Date().toISOString()
      });
    };
  }, [isOpen]);
  
  // Track visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('[TestPersistentModal] Document visibility changed', {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        inputValue,
        isOpen,
        timestamp: new Date().toISOString()
      });
    };
    
    const handleFocus = () => {
      console.log('[TestPersistentModal] Window gained focus', {
        inputValue,
        isOpen,
        timestamp: new Date().toISOString()
      });
    };
    
    const handleBlur = () => {
      console.log('[TestPersistentModal] Window lost focus', {
        inputValue,
        isOpen,
        timestamp: new Date().toISOString()
      });
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [inputValue, isOpen]);
  
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        console.log('[TestPersistentModal] Dialog onOpenChange triggered', {
          open,
          inputValue,
          timestamp: new Date().toISOString(),
          stackTrace: new Error().stack
        });
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test Modal - Render #{renderCount}</DialogTitle>
          <DialogDescription>
            Type something below, then tab away and come back to see if it persists.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="test-input">Test Input</Label>
            <Input
              id="test-input"
              value={inputValue}
              onChange={(e) => {
                console.log('[TestPersistentModal] Input changed', {
                  from: inputValue,
                  to: e.target.value,
                  timestamp: new Date().toISOString()
                });
                setInputValue(e.target.value);
              }}
              placeholder="Type something here..."
              className="mt-2"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Current value: "{inputValue}"
          </div>
          <div className="text-xs text-muted-foreground">
            Component render count: {renderCount}
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
