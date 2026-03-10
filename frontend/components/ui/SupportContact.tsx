import { Phone, Mail } from 'lucide-react';

interface SupportContactProps {
  className?: string;
}

export function SupportContact({ className = '' }: SupportContactProps) {
  return (
    <div className={`text-center space-y-1 ${className}`}>
      <p className="text-caption text-stone-400">Need help? Contact system support</p>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <a
          href="tel:+254113176613"
          className="inline-flex items-center gap-1.5 text-caption text-stone-500 hover:text-espresso transition-colors"
        >
          <Phone size={12} />
          0113 176 613
        </a>
        <a
          href="mailto:edwinfredofficial@gmail.com"
          className="inline-flex items-center gap-1.5 text-caption text-stone-500 hover:text-espresso transition-colors"
        >
          <Mail size={12} />
          edwinfredofficial@gmail.com
        </a>
      </div>
    </div>
  );
}
