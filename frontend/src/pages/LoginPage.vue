<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let raf: number | null = null;

type Particle = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  alpha: number;
  color: string;
};

function initParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 1.5 + 0.5,
    speedX: Math.random() * 0.4 - 0.2,
    speedY: Math.random() * -0.4 - 0.05,
    alpha: Math.random() * 0.4 + 0.1,
    color: Math.random() > 0.5 ? "242, 202, 80" : "212, 175, 55"
  };
}

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const particles: Particle[] = [];
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  const init = () => {
    particles.length = 0;
    for (let i = 0; i < 60; i++) particles.push(initParticle(canvas.width, canvas.height));
  };

  const onResize = () => {
    resize();
    init();
  };
  window.addEventListener("resize", onResize);
  resize();
  init();

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.y < -10 || p.x < 0 || p.x > canvas.width) {
        const np = initParticle(canvas.width, canvas.height);
        p.x = np.x;
        p.y = np.y;
        p.size = np.size;
        p.speedX = np.speedX;
        p.speedY = np.speedY;
        p.alpha = np.alpha;
        p.color = np.color;
      }
      ctx.shadowBlur = 4;
      ctx.shadowColor = `rgba(${p.color}, ${p.alpha})`;
      ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);

  onBeforeUnmount(() => {
    window.removeEventListener("resize", onResize);
  });
});

onBeforeUnmount(() => {
  if (raf != null) cancelAnimationFrame(raf);
});
</script>

<template>
  <div class="relative mx-auto grid max-w-5xl gap-10 py-10 px-6">
    <canvas ref="canvasRef" class="pointer-events-none fixed inset-0 z-0 opacity-40" />

    <section class="relative z-10 mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 p-10 backdrop-blur">
      <div class="text-center">
        <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-amber-300/80">Royal Access</div>
        <h1 class="mt-4 text-5xl font-headline font-extrabold uppercase tracking-[0.12em] text-amber-300">Connexion</h1>
        <p class="mt-5 text-lg italic leading-relaxed text-slate-200/80">
          Entre dans l'Empire. Connecte-toi pour créer ou rejoindre une partie.
        </p>
      </div>

      <div class="my-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

      <div class="grid grid-cols-2 gap-8">
        <button class="group flex flex-col items-center justify-center gap-3 py-4 transition-all duration-300 hover:scale-105" @click="auth.loginWithGoogle()">
          <div
            class="rf-shield relative flex h-20 w-16 items-center justify-center border-2 border-white/10 bg-white/5 transition-colors group-hover:border-amber-300/60 group-hover:bg-white/10"
          >
            <span class="material-symbols-outlined text-3xl text-amber-300" style="font-variation-settings: 'FILL' 1">castle</span>
          </div>
          <span class="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-200/80">House of Google</span>
        </button>

        <button class="group flex flex-col items-center justify-center gap-3 py-4 opacity-50" disabled>
          <div class="rf-shield relative flex h-20 w-16 items-center justify-center border-2 border-white/10 bg-white/5">
            <span class="material-symbols-outlined text-3xl text-amber-300" style="font-variation-settings: 'FILL' 1">groups</span>
          </div>
          <span class="text-[12px] font-bold uppercase tracking-[0.2em] text-slate-200/80">Discord (bientôt)</span>
        </button>
      </div>

      <div class="mt-12 text-center">
        <div class="text-xs uppercase tracking-[0.25em] text-slate-200/60">
          En continuant, tu acceptes les règles de l'Empire.
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rf-shield {
  clip-path: polygon(50% 0%, 88% 16%, 88% 60%, 50% 100%, 12% 60%, 12% 16%);
}
</style>
