export function Render({
	name,
	alt,
	width = 2400,
	height = 1650,
	sizes = "(min-width: 1024px) 50vw, 100vw",
	className,
}: {
	name: string;
	alt: string;
	width?: number;
	height?: number;
	sizes?: string;
	className?: string;
}) {
	return (
		<img
			src={`/renders/${name}.webp`}
			srcSet={`/renders/${name}-sm.webp ${width / 2}w, /renders/${name}.webp ${width}w`}
			sizes={sizes}
			alt={alt}
			width={width}
			height={height}
			loading="lazy"
			decoding="async"
			className={className}
		/>
	);
}
