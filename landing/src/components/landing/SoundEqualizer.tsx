interface SoundEqualizerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
}

const SoundEqualizer = ({ size = "md", color = "bg-primary" }: SoundEqualizerProps) => {
  const heightClass = {
    sm: "h-3.5 gap-0.5",
    md: "h-5 gap-1",
    lg: "h-7 gap-1.5",
  }[size];

  const barWidth = {
    sm: "w-0.5",
    md: "w-1",
    lg: "w-1.5",
  }[size];

  return (
    <div className={`inline-flex items-end ${heightClass}`} aria-hidden="true">
      <span className={`${barWidth} ${color} rounded-full animate-equalizer-1`} />
      <span className={`${barWidth} ${color} rounded-full animate-equalizer-2`} />
      <span className={`${barWidth} ${color} rounded-full animate-equalizer-3`} />
      <span className={`${barWidth} ${color} rounded-full animate-equalizer-4`} />
    </div>
  );
};

export default SoundEqualizer;
