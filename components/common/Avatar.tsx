import React, { useMemo, useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackText?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
};

const Avatar: React.FC<AvatarProps> = ({ src, alt = 'User avatar', size = 'sm', className = '', fallbackText }) => {
  const [imgError, setImgError] = useState(false);

  const initials = useMemo(() => {
    if (fallbackText && fallbackText.trim().length > 0) {
      const parts = fallbackText.trim().split(/\s+/);
      const first = parts[0]?.[0] || '';
      const second = parts.length > 1 ? parts[1]?.[0] || '' : '';
      return (first + second).toUpperCase();
    }
    return '?';
  }, [fallbackText]);

  const showImage = !!src && !imgError;

  return (
    <div className={`inline-flex items-center justify-center rounded-full bg-gray-700 text-gray-200 overflow-hidden ${sizeClasses[size]} ${className}`}
         title={alt}
         aria-label={alt}>
      {showImage ? (
        <img
          src={src || undefined}
          alt={alt}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="font-semibold select-none">{initials}</span>
      )}
    </div>
  );
};

export default Avatar;
