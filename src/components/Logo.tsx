import logoImage from '@/assets/logo.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex items-center gap-3">
      <img src={logoImage} alt="Faceless" className={`${sizes[size]} object-contain`} />
      {showText && (
        <span className={`font-mono font-bold tracking-tight text-gradient ${textSizes[size]}`}>
          Faceless
        </span>
      )}
    </div>
  );
}
