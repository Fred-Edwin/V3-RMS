'use client';

interface TypingIndicatorProps {
  name: string;
}

export function TypingIndicator({ name }: TypingIndicatorProps) {
  return (
    <div className="flex items-end gap-2 mb-1">
      <div className="bg-white border border-[#E8E0D5] rounded-2xl rounded-bl-sm px-4 py-3 max-w-[120px]">
        <p className="text-[10px] text-[#8B7355] mb-1.5">{name}</p>
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full bg-[#8B7355] animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-[#8B7355] animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-[#8B7355] animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
