<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useAuthStore } from "../stores/authStore";
import TopNavBar from "../components/TopNavBar.vue";

const auth = useAuthStore();
void auth;

const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf: number | null = null;

type Particle = {
  x: number; y: number;
  size: number;
  speedX: number; speedY: number;
  alpha: number;
  color: string;
  wobble: number;      // horizontal drift frequency
  wobbleSpeed: number; // horizontal drift speed
  wobbleAmp: number;   // horizontal drift amplitude
};

function initParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 2 + 0.4,
    speedX: Math.random() * 0.3 - 0.15,
    speedY: -(Math.random() * 0.5 + 0.1),
    alpha: Math.random() * 0.5 + 0.08,
    color: Math.random() > 0.45 ? "242, 202, 80" : Math.random() > 0.5 ? "212, 175, 55" : "255, 220, 100",
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: Math.random() * 0.015 + 0.005,
    wobbleAmp: Math.random() * 0.4 + 0.05
  };
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const PARTICLE_COUNT = 140;
  const particles: Particle[] = [];

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  const init = () => {
    particles.length = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(initParticle(canvas.width, canvas.height));
  };
  const onResize = () => { resize(); init(); };
  window.addEventListener("resize", onResize);
  resize();
  init();

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      // Horizontal wobble (sinusoidal drift)
      p.wobble += p.wobbleSpeed;
      p.x += p.speedX + Math.sin(p.wobble) * p.wobbleAmp;
      p.y += p.speedY;

      if (p.y < -10 || p.x < -20 || p.x > canvas.width + 20) {
        const np = initParticle(canvas.width, canvas.height);
        // Respawn at bottom when drifting off top
        np.y = canvas.height + 5;
        Object.assign(p, np);
      }

      ctx.shadowBlur   = p.size > 1.2 ? 6 : 3;
      ctx.shadowColor  = `rgba(${p.color}, ${p.alpha * 0.8})`;
      ctx.fillStyle    = `rgba(${p.color}, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);

  onBeforeUnmount(() => window.removeEventListener("resize", onResize));
});

onBeforeUnmount(() => { if (raf != null) cancelAnimationFrame(raf); });
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-900">
    <canvas ref="canvasRef" class="pointer-events-none fixed inset-0 z-[1] opacity-45" />
    <TopNavBar />
    <main class="relative z-[2] w-full pt-16">
      <slot />
    </main>
  </div>
</template>
