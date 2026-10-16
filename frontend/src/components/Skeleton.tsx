import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonProps> = ({ rows = 5, columns = 4, className = '' }) => {
  return (
    <div className={`skeleton-list ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="skeleton-block"
              style={{ width: `${c === 0 ? '30%' : c === columns - 1 ? '18%' : '100%'}` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  count?: number;
}

export const SkeletonCards: React.FC<SkeletonCardProps> = ({ count = 3 }) => {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-block" style={{ height: '112px' }} />
        </div>
      ))}
    </div>
  );
};