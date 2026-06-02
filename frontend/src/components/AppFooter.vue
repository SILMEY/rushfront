<script setup lang="ts">
import { useRouter } from "vue-router";
const router = useRouter();
</script>

<template>
  <footer class="stone-block border-t border-white/5 px-container-margin py-20">
    <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 md:flex-row">
      <div class="font-headline text-3xl font-bold tracking-[0.4em] text-primary">RUSHFRONT</div>
      <div class="flex gap-12">
        <button
          class="font-headline text-sm uppercase tracking-widest text-secondary/60 transition-colors hover:text-primary"
          @click="router.push('/privacy')"
        >Confidentialité</button>
        <button
          class="font-headline text-sm uppercase tracking-widest text-secondary/60 transition-colors hover:text-primary"
          @click="router.push('/support')"
        >Support</button>
      </div>
      <div class="font-headline text-[10px] uppercase tracking-[0.3em] text-secondary/40">© 2026 RUSHFRONT EMPIRE.</div>
    </div>
  </footer>
</template>

<style scoped>
.text-primary   { color: #d4af37; }
.text-secondary { color: #d4c59f; }
.px-container-margin { padding-left: 24px; padding-right: 24px; }
.stone-block {
  background-color: #1a1a1a;
  background-image: url("https://www.transparenttextures.com/patterns/dark-matter.png");
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.5);
}
</style>
