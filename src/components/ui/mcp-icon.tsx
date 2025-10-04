import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface MCPIconProps {
  className?: string;
  size?: number;
}

export function MCPIcon({ className, size = 16 }: MCPIconProps) {
  const { theme } = useTheme();
  
  // Use light icon for dark theme, dark icon for light theme
  const iconSrc = theme === 'dark' ? '/mcp-light.png' : '/mcp.png';
  
  return (
    <img
      src={iconSrc}
      alt="MCP"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', opacity: 0.8 }}
    />
  );
}

