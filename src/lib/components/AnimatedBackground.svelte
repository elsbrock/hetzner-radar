<!--
  AnimatedBackground Component
  
  Based on the original AnimatedBackground.tsx from Roo-Code-Docs
  Original source: https://github.com/RooCodeInc/Roo-Code-Docs
  Licensed under Apache License 2.0
  
  Modifications:
  - Ported from React/TypeScript to Svelte 5
  - Adapted to use Svelte runes syntax
  - Modified colors to match application theme
  - Added dark mode support
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Particle {
		x: number;
		y: number;
		size: number;
		speedX: number;
		speedY: number;
		color: string;
		opacity: number;
		baseOpacity: number;
		twinklePhase: number;
		twinkleSpeed: number;
	}

	interface GradientPoint {
		x: number;
		y: number;
		radius: number;
		color: string;
		targetX?: number;
		targetY?: number;
	}

	let canvas = $state<HTMLCanvasElement>();
	let isDarkMode = $state(false);

	onMount(() => {
		if (!browser || !canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Check for dark mode
		const checkDarkMode = () => {
			isDarkMode = document.documentElement.classList.contains('dark');
		};
		checkDarkMode();

		// Watch for theme changes
		const observer = new MutationObserver(() => {
			checkDarkMode();
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});

		// Grid settings
		const gridSize = 40;
		const gridOpacity = 0.1;

		// Initialize gradient points with theme colors
		let gradientPoints: GradientPoint[] = [];

		const updateGradientColors = () => {
			gradientPoints = [
				{
					x: canvas.width * 0.2,
					y: canvas.height * 0.3,
					radius: canvas.width * 0.4,
					color: isDarkMode ? 'rgba(255, 127, 80, 0.15)' : 'rgba(255, 127, 80, 0.1)' // Primary color with opacity
				},
				{
					x: canvas.width * 0.8,
					y: canvas.height * 0.7,
					radius: canvas.width * 0.5,
					color: isDarkMode ? 'rgba(255, 159, 112, 0.1)' : 'rgba(255, 159, 112, 0.08)' // Lighter variant
				}
			];
		};

		// Particle system
		const particles: Particle[] = [];
		const particleCount = Math.min(50, Math.floor(window.innerWidth / 40));

		// Resize canvas function
		const resizeCanvas = () => {
			const width = window.innerWidth;
			const height = window.innerHeight;

			canvas.width = width;
			canvas.height = height;

			updateGradientColors();
		};

		// Initialize canvas size
		resizeCanvas();

		// Particle class implementation
		class ParticleImpl implements Particle {
			x: number;
			y: number;
			size: number;
			speedX: number;
			speedY: number;
			color: string;
			opacity: number;
			baseOpacity: number;
			twinklePhase: number;
			twinkleSpeed: number;

			constructor() {
				this.x = Math.random() * canvas.width;
				this.y = Math.random() * canvas.height;
				this.size = Math.random() * 2 + 1;
				this.speedX = (Math.random() - 0.5) * 0.5;
				this.speedY = (Math.random() - 0.5) * 0.5;
				this.color = isDarkMode ? '#FF7F50' : '#FF7F50'; // Primary color
				this.baseOpacity = Math.random() * 0.3 + 0.2;
				this.opacity = this.baseOpacity;
				this.twinklePhase = Math.random() * Math.PI * 2;
				this.twinkleSpeed = Math.random() * 0.02 + 0.01; // Slow twinkling
			}

			update() {
				this.x += this.speedX;
				this.y += this.speedY;

				// Bounce off edges
				if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
				if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;

				// Constrain to canvas
				this.x = Math.max(0, Math.min(canvas.width, this.x));
				this.y = Math.max(0, Math.min(canvas.height, this.y));

				// Subtle twinkling effect
				this.twinklePhase += this.twinkleSpeed;
				const twinkle = Math.sin(this.twinklePhase) * 0.3 + 0.7; // Oscillates between 0.4 and 1.0
				this.opacity = this.baseOpacity * twinkle;
			}

			draw() {
				ctx.beginPath();
				ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
				ctx.fillStyle = `${this.color}${Math.floor(this.opacity * 255).toString(16).padStart(2, '0')}`;
				ctx.fill();
			}
		}

		// Initialize particles
		for (let i = 0; i < particleCount; i++) {
			particles.push(new ParticleImpl());
		}

		// Connect particles with lines
		const connectParticles = () => {
			for (let i = 0; i < particles.length; i++) {
				for (let j = i + 1; j < particles.length; j++) {
					const dx = particles[i].x - particles[j].x;
					const dy = particles[i].y - particles[j].y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					if (distance < 100) {
						ctx.beginPath();
						ctx.moveTo(particles[i].x, particles[i].y);
						ctx.lineTo(particles[j].x, particles[j].y);
						const opacity = (1 - distance / 100) * 0.3;
						ctx.strokeStyle = isDarkMode
							? `rgba(255, 127, 80, ${opacity})`
							: `rgba(255, 127, 80, ${opacity * 0.7})`;
						ctx.lineWidth = 0.5;
						ctx.stroke();
					}
				}
			}
		};

		// Update particles
		const updateParticles = () => {
			particles.forEach((particle) => {
				particle.update();
				particle.draw();
			});
			connectParticles();
		};

		// Draw grid with perspective
		const drawGrid = () => {
			const centerX = canvas.width / 2;
			const centerY = canvas.height * 0.9; // Balanced position for globe effect
			const perspective = 400; // Stronger perspective for more pronounced curve

			ctx.strokeStyle = isDarkMode
				? `rgba(255, 255, 255, ${gridOpacity})`
				: `rgba(0, 0, 0, ${gridOpacity * 0.5})`;
			ctx.lineWidth = 0.5;

			// Calculate grid bounds based on screen size
			const gridExtentY = Math.max(40, Math.ceil(canvas.height / gridSize));
			const gridExtentX = Math.max(50, Math.ceil(canvas.width / gridSize));

			// Horizontal lines
			for (let y = -20; y <= gridExtentY; y++) {
				ctx.beginPath();
				for (let x = -gridExtentX; x <= gridExtentX; x++) {
					const px = centerX + (x * gridSize * perspective) / (perspective + y * gridSize);
					const py = centerY + (y * gridSize * perspective) / (perspective + y * gridSize);
					if (x === -gridExtentX) {
						ctx.moveTo(px, py);
					} else {
						ctx.lineTo(px, py);
					}
				}
				ctx.stroke();
			}

			// Vertical lines
			for (let x = -gridExtentX; x <= gridExtentX; x++) {
				ctx.beginPath();
				for (let y = -20; y <= gridExtentY; y++) {
					const px = centerX + (x * gridSize * perspective) / (perspective + y * gridSize);
					const py = centerY + (y * gridSize * perspective) / (perspective + y * gridSize);
					if (y === -20) {
						ctx.moveTo(px, py);
					} else {
						ctx.lineTo(px, py);
					}
				}
				ctx.stroke();
			}
		};

		// Animate gradient points
		const animateGradientPoints = () => {
			gradientPoints.forEach((point, index) => {
				// Smooth movement towards target
				if (point.targetX !== undefined && point.targetY !== undefined) {
					point.x += (point.targetX - point.x) * 0.05;
					point.y += (point.targetY - point.y) * 0.05;
				} else {
					// Gentle floating motion
					point.x += Math.sin(Date.now() * 0.001 + index) * 0.5;
					point.y += Math.cos(Date.now() * 0.001 + index) * 0.5;
				}
			});
		};

		// Animation loop
		const animate = () => {
			// Clear canvas
			ctx.fillStyle = isDarkMode ? '#111827' : '#f9fafb';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Update gradient colors if theme changed
			if (isDarkMode !== document.documentElement.classList.contains('dark')) {
				checkDarkMode();
				updateGradientColors();
				// Update particle colors
				particles.forEach((particle) => {
					particle.color = '#FF7F50';
				});
			}

			// Draw gradient orbs
			gradientPoints.forEach((point) => {
				const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.radius);
				gradient.addColorStop(0, point.color);
				gradient.addColorStop(1, 'transparent');
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			});

			// Draw grid
			drawGrid();

			// Update and draw particles
			updateParticles();

			// Animate gradient points
			animateGradientPoints();

			requestAnimationFrame(animate);
		};

		// Handle mouse movement
		const handleMouseMove = (e: MouseEvent) => {
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			// Move the first gradient point towards mouse
			if (gradientPoints[0]) {
				gradientPoints[0].targetX = x;
				gradientPoints[0].targetY = y;
			}
		};

		// Handle mouse leave
		const handleMouseLeave = () => {
			// Reset target positions
			gradientPoints.forEach((point) => {
				point.targetX = undefined;
				point.targetY = undefined;
			});
		};

		// Event listeners
		window.addEventListener('resize', resizeCanvas);
		// Use document instead of canvas to ensure events are captured
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseleave', handleMouseLeave);

		// Start animation with a small delay to ensure canvas is ready
		requestAnimationFrame(() => {
			animate();
		});

		// Cleanup
		return () => {
			window.removeEventListener('resize', resizeCanvas);
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseleave', handleMouseLeave);
			observer.disconnect();
		};
	});
</script>

<canvas bind:this={canvas} class="fixed inset-0 -z-10 h-full w-full" />