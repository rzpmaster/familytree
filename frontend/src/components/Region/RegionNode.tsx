import { memo } from 'react';
import { NodeProps } from 'reactflow';

const RegionNode = ({ data, selected }: NodeProps) => {
  const bgColor = data.color || '#EBF8FF';
  
  return (
    <div 
      className={`w-full h-full rounded-2xl border-2 transition-colors duration-200 
      ${selected ? 'border-blue-600 shadow-lg' : 'border-blue-400 border-dashed'}
      `}
      style={{ 
        backgroundColor: selected ? `${bgColor}CC` : `${bgColor}80`
      }}
    >
      <div className="absolute -top-8 left-0 bg-white/80 px-2 py-1 rounded backdrop-blur-sm max-w-[200px] border border-blue-200 shadow-sm">
        <div className="text-sm font-bold text-blue-900 truncate">{data.label}</div>
         {data.description && (
             <div className="text-xs text-blue-700 truncate">{data.description}</div>
         )}
      </div>
    </div>
  );
};

export default memo(RegionNode);
